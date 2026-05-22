// Google Drive 備份與同步服務模組
// 使用 Google Identity Services (GIS) 的 Token Client 進行前端 OAuth2 隱含授權，
// 並使用原生 Fetch API 調用 Google Drive v3 進行 JSON 備份的上傳與下載。

export const GOOGLE_CLIENT_ID = '866673332924-qo09qab1pautrgcr4tuv6s2av0bp3g4n.apps.googleusercontent.com'; // 預設為預留佔位符，使用者可填入

let tokenClient = null;
let pendingAuthPromise = null;

/**
 * 初始化 Google Token Client
 * 確保載入的 google.accounts.oauth2 物件已就緒
 */
export function getGoogleTokenClient() {
  if (tokenClient) return tokenClient;
  if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
    return null;
  }

  // 支援從環境變數讀取，若無則採用定義的常數
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file', // 僅存取此應用建立的檔案，安全無虞
    callback: (response) => {
      if (response.error) {
        console.error('Google 授權失敗:', response);
        if (pendingAuthPromise) {
          pendingAuthPromise.reject(response);
          pendingAuthPromise = null;
        }
      } else {
        const accessToken = response.access_token;
        const expiresIn = response.expires_in || 3600;
        const expiresAt = Date.now() + (expiresIn - 300) * 1000; // 提早 5 分鐘緩衝

        // 寫入本地存儲以便於 1 小時內重複呼叫 API
        localStorage.setItem('google_drive_access_token', accessToken);
        localStorage.setItem('google_drive_token_expires_at', String(expiresAt));
        localStorage.setItem('google_drive_linked', 'true');

        if (pendingAuthPromise) {
          pendingAuthPromise.resolve(accessToken);
          pendingAuthPromise = null;
        }
      }
    },
  });

  return tokenClient;
}

/**
 * 彈出 Google 授權視窗，請求使用者授予 Google Drive 權限
 * @returns {Promise<string>} 回傳 valid Access Token
 */
export function requestAuth() {
  return new Promise((resolve, reject) => {
    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(new Error('Google SDK 尚未載入完成，請確認網路連線或 index.html 是否載入腳本。'));
      return;
    }

    const client = getGoogleTokenClient();
    if (!client) {
      reject(new Error('無法初始化 Google Token Client，請確認 Client ID 是否正確。'));
      return;
    }

    pendingAuthPromise = { resolve, reject };
    // 使用 prompt: 'consent' 強制彈出同意畫面取得 Token
    client.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * 確保當前本地存儲的 Token 有效且未過期
 * @returns {string} 有效的 Access Token
 * @throws {Error} 若未連結帳號或 Token 已過期則拋出異常
 */
export function ensureValidToken() {
  const isLinked = localStorage.getItem('google_drive_linked') === 'true';
  const accessToken = localStorage.getItem('google_drive_access_token');
  const expiresAt = Number(localStorage.getItem('google_drive_token_expires_at')) || 0;

  if (!isLinked) {
    throw new Error('NOT_LINKED');
  }

  if (!accessToken || Date.now() > expiresAt) {
    throw new Error('TOKEN_EXPIRED');
  }

  return accessToken;
}

/**
 * 解除 Google 帳號的雲端同步連結並清除本地 token
 */
export function disconnectGoogleDrive() {
  localStorage.removeItem('google_drive_access_token');
  localStorage.removeItem('google_drive_token_expires_at');
  localStorage.removeItem('google_drive_linked');
}

/**
 * 將資料上傳備份至 Google Drive
 * 若 CollectTrack_Backup.json 已存在則覆蓋它，否則新建。
 * @param {object} backupData 備份的 JSON 物件
 */
export async function uploadBackup(backupData) {
  const token = ensureValidToken();

  // 1. 搜尋雲端硬碟中是否已存在同名備份檔
  const q = encodeURIComponent("name='CollectTrack_Backup.json' and trashed=false");
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
  
  const searchRes = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!searchRes.ok) {
    throw new Error(`查詢雲端檔案失敗: ${searchRes.status} ${searchRes.statusText}`);
  }

  const searchData = await searchRes.json();
  const existingFile = searchData.files && searchData.files[0];
  const jsonString = JSON.stringify(backupData, null, 2);

  if (existingFile) {
    // 2a. 檔案存在，使用 PATCH 覆蓋其內容
    const fileId = existingFile.id;
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: jsonString
    });

    if (!updateRes.ok) {
      throw new Error(`覆蓋雲端備份失敗: ${updateRes.status} ${updateRes.statusText}`);
    }

    return await updateRes.json();
  } else {
    // 2b. 檔案不存在，使用 Multipart POST 新增檔案
    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const boundary = 'CollectTrackBoundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: 'CollectTrack_Backup.json',
      mimeType: 'application/json'
    };

    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      jsonString +
      closeDelimiter;

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!createRes.ok) {
      throw new Error(`建立雲端備份失敗: ${createRes.status} ${createRes.statusText}`);
    }

    return await createRes.json();
  }
}

/**
 * 從 Google Drive 下載備份並還原
 * @returns {Promise<object|null>} 返回 JSON 備份檔案內容，若無檔案則傳回 null
 */
export async function downloadBackup() {
  const token = ensureValidToken();

  // 1. 搜尋雲端硬碟中是否有 CollectTrack_Backup.json 檔案
  const q = encodeURIComponent("name='CollectTrack_Backup.json' and trashed=false");
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!searchRes.ok) {
    throw new Error(`查詢雲端備份檔案失敗: ${searchRes.status} ${searchRes.statusText}`);
  }

  const searchData = await searchRes.json();
  const existingFile = searchData.files && searchData.files[0];

  if (!existingFile) {
    return null; // 找不到檔案
  }

  // 2. 獲取檔案內容 (alt=media)
  const fileId = existingFile.id;
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const downloadRes = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!downloadRes.ok) {
    throw new Error(`下載雲端備份失敗: ${downloadRes.status} ${downloadRes.statusText}`);
  }

  return await downloadRes.json();
}
