// =========================================================
// sgit frontend
// Supabase Authは使用しません。
// 認証はNode.jsサーバー側で行います。
// =========================================================

// SupabaseはStorageの公開URL取得にのみ使用します。
const SUPABASE_URL = "https://vkgkkvxybqcfbomvhgwa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uC9VF8HVY6a1_XT3N-w8xQ_Efnc-Oih";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


let currentUser = null;
let currentTab = 'all';


// =========================================================
// API helper
// =========================================================

async function apiFetch(url, options = {}) {
  const finalOptions = {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, finalOptions);

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && data.error
        ? data.error
        : 'Request failed';

    throw new Error(message);
  }

  return data;
}


// =========================================================
// 初期化
// =========================================================

async function init() {
  try {
    const data = await apiFetch('/api/auth/me');

    if (data && data.user) {
      currentUser = data.user;
      showApp();
    } else {
      currentUser = null;
      showAuth();
    }
  } catch (error) {
    currentUser = null;
    showAuth();
  }
}


// =========================================================
// 認証画面切り替え
// =========================================================

function showRegisterView(e) {
  if (e) {
    e.preventDefault();
  }

  document.getElementById('login-view').style.display = 'none';
  document.getElementById('register-view').style.display = 'block';
}


function showLoginView(e) {
  if (e) {
    e.preventDefault();
  }

  document.getElementById('register-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'block';
}


// =========================================================
// 新規登録
// =========================================================

async function signUp() {
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');

  const email = emailInput.value.trim();
  const password = passwordInput.value;


  if (!email || !password) {
    return showToast(
      'Please enter both email and password'
    );
  }


  if (password.length < 6) {
    return showToast(
      'Password must be at least 6 characters'
    );
  }


  const button =
    document.querySelector(
      '#register-view .btn-success'
    );

  if (button) {
    button.disabled = true;
  }


  try {
    const data = await apiFetch(
      '/api/auth/register',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          email,
          password
        })
      }
    );


    currentUser = data.user;

    showApp();

    showToast(
      'Account created successfully'
    );

  } catch (error) {

    showToast(
      error.message || 'Registration failed'
    );

  } finally {

    if (button) {
      button.disabled = false;
    }

  }
}


// =========================================================
// ログイン
// =========================================================

async function signIn() {
  const emailInput =
    document.getElementById('login-email');

  const passwordInput =
    document.getElementById('login-password');


  const email =
    emailInput.value.trim();

  const password =
    passwordInput.value;


  if (!email || !password) {
    return showToast(
      'Please enter both email and password'
    );
  }


  const button =
    document.querySelector(
      '#login-view .btn-primary'
    );

  if (button) {
    button.disabled = true;
  }


  try {

    const data =
      await apiFetch(
        '/api/auth/login',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            email,
            password
          })
        }
      );


    currentUser = data.user;

    showApp();

    showToast(
      'Signed in successfully'
    );

  } catch (error) {

    showToast(
      error.message || 'Sign in failed'
    );

  } finally {

    if (button) {
      button.disabled = false;
    }

  }
}


// =========================================================
// ログアウト
// =========================================================

async function signOut() {
  try {

    await apiFetch(
      '/api/auth/logout',
      {
        method: 'POST'
      }
    );

  } catch (error) {

    console.error(
      'Sign out error:',
      error
    );

  }


  currentUser = null;

  showAuth();

  showToast(
    'Signed out successfully'
  );
}


// =========================================================
// 認証画面表示
// =========================================================

function showAuth() {
  document.getElementById(
    'auth-container'
  ).style.display = 'flex';

  document.getElementById(
    'main-navbar'
  ).style.display = 'none';

  document.getElementById(
    'app-section'
  ).style.display = 'none';
}


// =========================================================
// アプリ表示
// =========================================================

function showApp() {
  document.getElementById(
    'auth-container'
  ).style.display = 'none';

  document.getElementById(
    'main-navbar'
  ).style.display = 'block';

  document.getElementById(
    'app-section'
  ).style.display = 'block';


  const emailDisplay =
    document.getElementById(
      'user-email-display'
    );


  if (emailDisplay && currentUser) {
    emailDisplay.innerText =
      currentUser.email;
  }


  loadRepositories();
}


// =========================================================
// タブ切り替え
// =========================================================

function switchTab(tab) {
  currentTab = tab;


  document.getElementById(
    'tab-all'
  ).classList.remove('active');

  document.getElementById(
    'tab-mine'
  ).classList.remove('active');


  if (tab === 'all') {

    document.getElementById(
      'tab-all'
    ).classList.add('active');

  } else {

    document.getElementById(
      'tab-mine'
    ).classList.add('active');

  }


  loadRepositories();
}


// =========================================================
// リポジトリ一覧
// =========================================================

async function loadRepositories() {
  const repoList =
    document.getElementById(
      'repo-list'
    );


  repoList.innerHTML =
    '<p style="color: var(--text-muted)">Loading repositories...</p>';


  try {

    let repos =
      await apiFetch(
        '/api/repositories'
      );


    if (currentTab === 'mine') {

      repos =
        repos.filter(
          r =>
            currentUser &&
            r.user_id === currentUser.id
        );

    }


    if (
      !Array.isArray(repos) ||
      repos.length === 0
    ) {

      repoList.innerHTML =
        '<p style="color: var(--text-muted)">No repositories found.</p>';

      return;
    }


    repoList.innerHTML = '';


    for (const repo of repos) {

      try {

        const files =
          await apiFetch(
            `/api/repositories/${encodeURIComponent(repo.id)}/files`
          );


        const isOwner =
          currentUser &&
          repo.user_id === currentUser.id;


        const card =
          document.createElement('div');


        card.className =
          'repo-card';


        const safeRepoName =
          escapeHtml(repo.name);

        const safeDescription =
          escapeHtml(
            repo.description ||
            'No description provided.'
          );


        let filesHtml = '';


        if (
          Array.isArray(files) &&
          files.length > 0
        ) {

          filesHtml =
            files
              .map(
                f => {

                  const safeFileName =
                    escapeHtml(
                      f.name || ''
                    );


                  const size =
                    Number(
                      f.metadata?.size || 0
                    );


                  return `
                    <li class="file-item">
                      <span
                        class="file-link"
                        onclick="previewFile('${escapeJsString(repo.id)}', '${escapeJsString(f.name)}')"
                      >
                        📄 ${safeFileName}
                      </span>

                      <small style="color: var(--text-muted);">
                        ${(size / 1024).toFixed(1)} KB
                      </small>
                    </li>
                  `;
                }
              )
              .join('');

        } else {

          filesHtml =
            '<li class="file-item" style="color: var(--text-muted);">No files in this repository</li>';

        }


        let uploadHtml = '';


        if (isOwner) {

          uploadHtml = `
            <div class="upload-box">

              <input
                type="file"
                id="file-${escapeHtml(repo.id)}"
                class="input"
                style="padding: 4px;"
              >

              <button
                class="btn btn-secondary btn-sm"
                onclick="uploadFile('${escapeJsString(repo.id)}')"
              >
                Upload file
              </button>

            </div>
          `;

        }


        card.innerHTML = `
          <div class="repo-title-bar">

            <div>

              <span class="repo-name">
                ${safeRepoName}
              </span>

              <p class="repo-desc">
                ${safeDescription}
              </p>

            </div>

            ${
              isOwner
                ? '<span class="btn btn-outline btn-sm" style="pointer-events:none;">Owner</span>'
                : ''
            }

          </div>


          <div class="file-section">

            <ul class="file-list">
              ${filesHtml}
            </ul>

            ${uploadHtml}

          </div>
        `;


        repoList.appendChild(card);

      } catch (fileError) {

        console.error(
          'Failed to load repository files:',
          fileError
        );


        const card =
          document.createElement('div');


        card.className =
          'repo-card';


        card.innerHTML = `
          <div class="repo-title-bar">

            <div>

              <span class="repo-name">
                ${escapeHtml(repo.name)}
              </span>

              <p class="repo-desc">
                ${escapeHtml(
                  repo.description ||
                  'No description provided.'
                )}
              </p>

            </div>

          </div>

          <div class="file-section">
            <p style="color: var(--text-muted);">
              Failed to load files.
            </p>
          </div>
        `;


        repoList.appendChild(card);
      }
    }

  } catch (error) {

    console.error(
      'Failed to load repositories:',
      error
    );


    if (
      error.message === 'Authentication required'
    ) {

      currentUser = null;

      showAuth();

      return;
    }


    showToast(
      error.message ||
      'Failed to load repositories'
    );

  }
}


// =========================================================
// ファイルプレビュー
// =========================================================

async function previewFile(
  repoId,
  fileName
) {

  const modal =
    document.getElementById(
      'preview-modal'
    );


  const codeElem =
    document.getElementById(
      'preview-content'
    );


  document.getElementById(
    'preview-filename'
  ).innerText = fileName;


  codeElem.innerText =
    'Loading...';


  modal.style.display =
    'flex';


  try {

    const {
      data
    } =
      supabaseClient.storage
        .from('code-files')
        .getPublicUrl(
          `${repoId}/${fileName}`
        );


    if (
      !data ||
      !data.publicUrl
    ) {

      throw new Error(
        'Could not create public URL'
      );

    }


    const res =
      await fetch(
        data.publicUrl
      );


    if (!res.ok) {

      throw new Error(
        'Failed to fetch file'
      );

    }


    const text =
      await res.text();


    codeElem.innerText =
      text;

  } catch (error) {

    console.error(
      'Preview error:',
      error
    );


    codeElem.innerText =
      'Failed to load file preview.';

  }
}


// =========================================================
// プレビューモーダルを閉じる
// =========================================================

function closePreviewModal() {
  document.getElementById(
    'preview-modal'
  ).style.display = 'none';
}


// =========================================================
// ファイルアップロード
// =========================================================

async function uploadFile(repoId) {

  if (!currentUser) {
    return showToast(
      'Please sign in first'
    );
  }


  const fileInput =
    document.getElementById(
      `file-${repoId}`
    );


  if (
    !fileInput ||
    !fileInput.files ||
    !fileInput.files[0]
  ) {

    return showToast(
      'Please select a file'
    );

  }


  const file =
    fileInput.files[0];


  const formData =
    new FormData();


  formData.append(
    'file',
    file
  );


  try {

    const result =
      await apiFetch(
        `/api/repositories/${encodeURIComponent(repoId)}/files`,
        {
          method: 'POST',
          body: formData
        }
      );


    if (result) {

      showToast(
        'File uploaded successfully'
      );

      fileInput.value = '';

      loadRepositories();

    }

  } catch (error) {

    console.error(
      'Upload error:',
      error
    );


    showToast(
      error.message ||
      'Upload failed'
    );

  }
}


// =========================================================
// 新規リポジトリ作成モーダル
// =========================================================

function openNewRepoModal() {
  document.getElementById(
    'repo-modal'
  ).style.display = 'flex';
}


function closeNewRepoModal() {
  document.getElementById(
    'repo-modal'
  ).style.display = 'none';
}


// =========================================================
// リポジトリ作成
// =========================================================

document
  .getElementById('create-repo-form')
  .addEventListener(
    'submit',
    async (e) => {

      e.preventDefault();


      if (!currentUser) {

        showToast(
          'Please sign in first'
        );

        return;
      }


      const name =
        document
          .getElementById('repo-name')
          .value
          .trim();


      const description =
        document
          .getElementById('repo-desc')
          .value
          .trim();


      if (!name) {

        showToast(
          'Repository name is required'
        );

        return;
      }


      const submitButton =
        document.querySelector(
          '#create-repo-form button[type="submit"]'
        );


      if (submitButton) {
        submitButton.disabled = true;
      }


      try {

        await apiFetch(
          '/api/repositories',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              name,
              description
            })
          }
        );


        closeNewRepoModal();


        document.getElementById(
          'repo-name'
        ).value = '';


        document.getElementById(
          'repo-desc'
        ).value = '';


        showToast(
          'Repository created successfully'
        );


        loadRepositories();

      } catch (error) {

        console.error(
          'Repository creation error:',
          error
        );


        showToast(
          error.message ||
          'Failed to create repository'
        );

      } finally {

        if (submitButton) {
          submitButton.disabled = false;
        }

      }

    }
  );


// =========================================================
// トースト
// =========================================================

function showToast(msg) {

  const toast =
    document.getElementById(
      'toast'
    );


  toast.innerText =
    msg;


  toast.style.display =
    'block';


  setTimeout(
    () => {
      toast.style.display =
        'none';
    },
    3000
  );
}


// =========================================================
// HTMLエスケープ
// =========================================================

function escapeHtml(str) {

  if (
    str === null ||
    str === undefined
  ) {
    return '';
  }


  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      })[m]
  );
}


// =========================================================
// JavaScript文字列用エスケープ
// =========================================================

function escapeJsString(str) {

  if (
    str === null ||
    str === undefined
  ) {
    return '';
  }


  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}


// =========================================================
// アプリケーション開始
// =========================================================

init();
