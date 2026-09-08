// Supabase 設定
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentTab = 'all';

// 初期化
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    showAuth();
  }
}

// 認証画面表示切り替え (Sign in <-> Sign up)
function showRegisterView(e) {
  if (e) e.preventDefault();
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('register-view').style.display = 'block';
}

function showLoginView(e) {
  if (e) e.preventDefault();
  document.getElementById('register-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'block';
}

// ユーザー新規登録
async function signUp() {
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  if (!email || !password) {
    return showToast('Please enter both email and password');
  }

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    showToast(error.message);
  } else {
    showToast('Account created! Please check your email for confirmation.');
  }
}

// ログイン
async function signIn() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    return showToast('Please enter both email and password');
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message);
  } else {
    currentUser = data.user;
    showApp();
    showToast('Signed in successfully');
  }
}

// ログアウト
async function signOut() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  showAuth();
  showToast('Signed out successfully');
}

// アプリケーション表示切り替え
function showAuth() {
  document.getElementById('auth-container').style.display = 'flex';
  document.getElementById('main-navbar').style.display = 'none';
  document.getElementById('app-section').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('main-navbar').style.display = 'block';
  document.getElementById('app-section').style.display = 'block';
  document.getElementById('user-email-display').innerText = currentUser.email;
  loadRepositories();
}

// タブ切り替え
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-all').classList.remove('active');
  document.getElementById('tab-mine').classList.remove('active');

  if (tab === 'all') {
    document.getElementById('tab-all').classList.add('active');
  } else {
    document.getElementById('tab-mine').classList.add('active');
  }

  loadRepositories();
}

// リポジトリ一覧の取得と表示
async function loadRepositories() {
  const repoList = document.getElementById('repo-list');
  repoList.innerHTML = '<p style="color: var(--text-muted)">Loading repositories...</p>';

  try {
    const res = await fetch('/api/repositories');
    let repos = await res.json();

    if (currentTab === 'mine') {
      repos = repos.filter(r => r.user_id === currentUser.id);
    }

    if (!Array.isArray(repos) || repos.length === 0) {
      repoList.innerHTML = '<p style="color: var(--text-muted)">No repositories found.</p>';
      return;
    }

    repoList.innerHTML = '';
    for (const repo of repos) {
      const filesRes = await fetch(`/api/repositories/${repo.id}/files`);
      const files = await filesRes.json();
      const isOwner = repo.user_id === currentUser.id;

      const card = document.createElement('div');
      card.className = 'repo-card';
      card.innerHTML = `
        <div class="repo-title-bar">
          <div>
            <span class="repo-name">${escapeHtml(repo.name)}</span>
            <p class="repo-desc">${escapeHtml(repo.description || 'No description provided.')}</p>
          </div>
          ${isOwner ? '<span class="btn btn-outline btn-sm" style="pointer-events:none;">Owner</span>' : ''}
        </div>

        <div class="file-section">
          <ul class="file-list">
            ${Array.isArray(files) && files.length > 0 
              ? files.map(f => `
                <li class="file-item">
                  <span class="file-link" onclick="previewFile('${repo.id}', '${escapeHtml(f.name)}')">📄 ${escapeHtml(f.name)}</span>
                  <small style="color: var(--text-muted);">${(f.metadata?.size / 1024 || 0).toFixed(1)} KB</small>
                </li>
              `).join('')
              : '<li class="file-item" style="color: var(--text-muted);">No files in this repository</li>'
            }
          </ul>
          
          ${isOwner ? `
            <div class="upload-box">
              <input type="file" id="file-${repo.id}" class="input" style="padding: 4px;">
              <button class="btn btn-secondary btn-sm" onclick="uploadFile('${repo.id}')">Upload file</button>
            </div>
          ` : ''}
        </div>
      `;
      repoList.appendChild(card);
    }
  } catch (err) {
    showToast('Failed to load repositories');
  }
}

// ファイルプレビューモーダルの表示
async function previewFile(repoId, fileName) {
  const modal = document.getElementById('preview-modal');
  const codeElem = document.getElementById('preview-content');
  document.getElementById('preview-filename').innerText = fileName;

  codeElem.innerText = 'Loading...';
  modal.style.display = 'flex';

  try {
    const { data } = supabaseClient.storage.from('code-files').getPublicUrl(`${repoId}/${fileName}`);
    const res = await fetch(data.publicUrl);
    const text = await res.text();
    codeElem.innerText = text;
  } catch (e) {
    codeElem.innerText = 'Failed to load file preview.';
  }
}

function closePreviewModal() {
  document.getElementById('preview-modal').style.display = 'none';
}

// ファイルアップロード機能
async function uploadFile(repoId) {
  const fileInput = document.getElementById(`file-${repoId}`);
  if (!fileInput.files[0]) return showToast('Please select a file');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('repoId', repoId);

  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (res.ok) {
    showToast('File uploaded successfully');
    fileInput.value = '';
    loadRepositories();
  } else {
    showToast('Upload failed');
  }
}

// 新規リポジトリ作成モーダル制御
function openNewRepoModal() {
  document.getElementById('repo-modal').style.display = 'flex';
}

function closeNewRepoModal() {
  document.getElementById('repo-modal').style.display = 'none';
}

document.getElementById('create-repo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('repo-name').value;
  const description = document.getElementById('repo-desc').value;

  const res = await fetch('/api/repositories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, userId: currentUser.id })
  });

  if (res.ok) {
    closeNewRepoModal();
    document.getElementById('repo-name').value = '';
    document.getElementById('repo-desc').value = '';
    showToast('Repository created successfully');
    loadRepositories();
  } else {
    showToast('Failed to create repository');
  }
});

// ユーティリティ
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

// アプリケーションの開始
init();
