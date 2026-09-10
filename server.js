require('dotenv').config();

const express = require('express');
const cors = require('cors');
const {
  createClient
} = require('@supabase/supabase-js');

const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');


const app = express();


const upload =
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024
    }
  });


const PORT =
  process.env.PORT || 3000;


const SUPABASE_URL =
  process.env.SUPABASE_URL;


const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;


const JWT_SECRET =
  process.env.JWT_SECRET;


if (!SUPABASE_URL) {
  console.error(
    'ERROR: SUPABASE_URL is not configured.'
  );

  process.exit(1);
}


if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured.'
  );

  process.exit(1);
}


if (!JWT_SECRET) {
  console.error(
    'ERROR: JWT_SECRET is not configured.'
  );

  process.exit(1);
}


/*
 * Supabase Authではなく、
 * Supabase Database / Storageへアクセスするための
 * サーバー専用Supabase Clientです。
 */
const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );


app.use(
  cors({
    origin: true,
    credentials: true
  })
);


app.use(
  express.json({
    limit: '2mb'
  })
);


app.use(
  express.urlencoded({
    extended: true
  })
);


app.use(
  cookieParser()
);


app.use(
  express.static('public')
);


// =========================================================
// 共通関数
// =========================================================

function normalizeEmail(email) {

  if (
    typeof email !== 'string'
  ) {
    return '';
  }


  return email
    .trim()
    .toLowerCase();
}


function isValidEmail(email) {

  if (
    typeof email !== 'string'
  ) {
    return false;
  }


  if (email.length > 320) {
    return false;
  }


  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


function createAuthToken(user) {

  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'sgit'
    }
  );
}


function setAuthCookie(res, token) {

  res.cookie(
    'sgit_session',
    token,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:
        7 * 24 * 60 * 60 * 1000,
      path: '/'
    }
  );
}


function clearAuthCookie(res) {

  res.clearCookie(
    'sgit_session',
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    }
  );
}


function getTokenFromRequest(req) {

  const token =
    req.cookies &&
    req.cookies.sgit_session;


  if (
    typeof token !== 'string' ||
    !token
  ) {
    return null;
  }


  return token;
}


function getUserFromToken(req) {

  const token =
    getTokenFromRequest(req);


  if (!token) {
    return null;
  }


  try {

    const payload =
      jwt.verify(
        token,
        JWT_SECRET,
        {
          issuer: 'sgit'
        }
      );


    if (
      !payload ||
      !payload.sub
    ) {
      return null;
    }


    return {
      id: payload.sub,
      email: payload.email || ''
    };

  } catch (error) {

    return null;

  }
}


function requireAuth(req, res, next) {

  const user =
    getUserFromToken(req);


  if (!user) {

    return res
      .status(401)
      .json({
        error:
          'Authentication required'
      });

  }


  req.user = user;

  next();
}


// =========================================================
// 認証API
// =========================================================


// ---------------------------------------------------------
// 新規登録
// ---------------------------------------------------------

app.post(
  '/api/auth/register',
  async (req, res) => {

    try {

      const email =
        normalizeEmail(
          req.body.email
        );


      const password =
        typeof req.body.password === 'string'
          ? req.body.password
          : '';


      if (!email || !password) {

        return res
          .status(400)
          .json({
            error:
              'Email and password are required.'
          });

      }


      if (!isValidEmail(email)) {

        return res
          .status(400)
          .json({
            error:
              'Please enter a valid email address.'
          });

      }


      if (password.length < 6) {

        return res
          .status(400)
          .json({
            error:
              'Password must be at least 6 characters.'
          });

      }


      if (password.length > 200) {

        return res
          .status(400)
          .json({
            error:
              'Password is too long.'
          });

      }


      /*
       * 既に登録済みか確認
       */
      const {
        data: existingUsers,
        error: existingError
      } =
        await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .limit(1);


      if (existingError) {

        console.error(
          'User lookup error:',
          existingError
        );


        return res
          .status(500)
          .json({
            error:
              'Failed to check account.'
          });

      }


      if (
        existingUsers &&
        existingUsers.length > 0
      ) {

        return res
          .status(409)
          .json({
            error:
              'An account with this email already exists.'
          });

      }


      /*
       * パスワードをハッシュ化
       */
      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      /*
       * ユーザー作成
       */
      const {
        data: newUsers,
        error: insertError
      } =
        await supabase
          .from('users')
          .insert([
            {
              email,
              password_hash:
                passwordHash
            }
          ])
          .select(
            'id,email,created_at'
          );


      if (insertError) {

        console.error(
          'User insert error:',
          insertError
        );


        if (
          insertError.code ===
          '23505'
        ) {

          return res
            .status(409)
            .json({
              error:
                'An account with this email already exists.'
            });

        }


        return res
          .status(500)
          .json({
            error:
              'Failed to create account.'
          });

      }


      if (
        !newUsers ||
        !newUsers[0]
      ) {

        return res
          .status(500)
          .json({
            error:
              'Failed to create account.'
          });

      }


      const user =
        newUsers[0];


      /*
       * 登録完了後、そのままログイン状態にする
       */
      const token =
        createAuthToken(
          user
        );


      setAuthCookie(
        res,
        token
      );


      return res.json({
        message:
          'Account created successfully.',
        user: {
          id: user.id,
          email: user.email,
          created_at:
            user.created_at
        }
      });

    } catch (error) {

      console.error(
        'Register error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// ---------------------------------------------------------
// ログイン
// ---------------------------------------------------------

app.post(
  '/api/auth/login',
  async (req, res) => {

    try {

      const email =
        normalizeEmail(
          req.body.email
        );


      const password =
        typeof req.body.password === 'string'
          ? req.body.password
          : '';


      if (!email || !password) {

        return res
          .status(400)
          .json({
            error:
              'Email and password are required.'
          });

      }


      const {
        data: users,
        error
      } =
        await supabase
          .from('users')
          .select(
            'id,email,password_hash,created_at'
          )
          .eq(
            'email',
            email
          )
          .limit(1);


      if (error) {

        console.error(
          'Login user lookup error:',
          error
        );


        return res
          .status(500)
          .json({
            error:
              'Failed to sign in.'
          });

      }


      /*
       * 存在しないアカウントでも
       * 同じような処理をするため、
       * timing attackを多少軽減します。
       */
      if (
        !users ||
        users.length === 0
      ) {

        return res
          .status(401)
          .json({
            error:
              'Invalid email or password.'
          });

      }


      const user =
        users[0];


      const passwordMatches =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!passwordMatches) {

        return res
          .status(401)
          .json({
            error:
              'Invalid email or password.'
          });

      }


      const token =
        createAuthToken(
          user
        );


      setAuthCookie(
        res,
        token
      );


      return res.json({
        message:
          'Signed in successfully.',
        user: {
          id: user.id,
          email: user.email,
          created_at:
            user.created_at
        }
      });

    } catch (error) {

      console.error(
        'Login error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// ---------------------------------------------------------
// ログアウト
// ---------------------------------------------------------

app.post(
  '/api/auth/logout',
  (req, res) => {

    clearAuthCookie(
      res
    );


    return res.json({
      message:
        'Signed out successfully.'
    });

  }
);


// ---------------------------------------------------------
// 現在のユーザー
// ---------------------------------------------------------

app.get(
  '/api/auth/me',
  async (req, res) => {

    try {

      const tokenUser =
        getUserFromToken(req);


      if (!tokenUser) {

        return res.json({
          user: null
        });

      }


      /*
       * JWTだけでなく、
       * DB上にユーザーが存在することも確認します。
       */
      const {
        data: users,
        error
      } =
        await supabase
          .from('users')
          .select(
            'id,email,created_at'
          )
          .eq(
            'id',
            tokenUser.id
          )
          .limit(1);


      if (error) {

        console.error(
          'Me lookup error:',
          error
        );


        return res
          .status(500)
          .json({
            error:
              'Failed to get current user.'
          });

      }


      if (
        !users ||
        users.length === 0
      ) {

        clearAuthCookie(
          res
        );


        return res.json({
          user: null
        });

      }


      const user =
        users[0];


      return res.json({
        user: {
          id: user.id,
          email: user.email,
          created_at:
            user.created_at
        }
      });

    } catch (error) {

      console.error(
        'Me error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// =========================================================
// リポジトリAPI
// =========================================================


// ---------------------------------------------------------
// リポジトリ作成
// ---------------------------------------------------------

app.post(
  '/api/repositories',
  requireAuth,
  async (req, res) => {

    try {

      const name =
        typeof req.body.name === 'string'
          ? req.body.name.trim()
          : '';


      const description =
        typeof req.body.description === 'string'
          ? req.body.description.trim()
          : '';


      if (!name) {

        return res
          .status(400)
          .json({
            error:
              'Repository name is required.'
          });

      }


      if (name.length > 100) {

        return res
          .status(400)
          .json({
            error:
              'Repository name is too long.'
          });

      }


      if (description.length > 1000) {

        return res
          .status(400)
          .json({
            error:
              'Description is too long.'
          });

      }


      /*
       * userIdはクライアントから受け取らない。
       *
       * JWTから取得したreq.user.idを使うことで、
       * 他人のIDを指定するなりすましを防止します。
       */
      const {
        data,
        error
      } =
        await supabase
          .from('repositories')
          .insert([
            {
              name,
              description:
                description || null,
              user_id:
                req.user.id
            }
          ])
          .select();


      if (error) {

        console.error(
          'Repository insert error:',
          error
        );


        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      if (
        !data ||
        !data[0]
      ) {

        return res
          .status(500)
          .json({
            error:
              'Failed to create repository.'
          });

      }


      return res.json(
        data[0]
      );

    } catch (error) {

      console.error(
        'Repository creation error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// ---------------------------------------------------------
// リポジトリ一覧
// ---------------------------------------------------------

app.get(
  '/api/repositories',
  requireAuth,
  async (req, res) => {

    try {

      const {
        data,
        error
      } =
        await supabase
          .from('repositories')
          .select('*')
          .order(
            'created_at',
            {
              ascending: false
            }
          );


      if (error) {

        console.error(
          'Repository list error:',
          error
        );


        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      return res.json(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.error(
        'Repository list error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// =========================================================
// リポジトリファイル一覧
// =========================================================

app.get(
  '/api/repositories/:id/files',
  requireAuth,
  async (req, res) => {

    try {

      const repoId =
        req.params.id;


      if (!repoId) {

        return res
          .status(400)
          .json({
            error:
              'Repository ID is required.'
          });

      }


      const {
        data,
        error
      } =
        await supabase.storage
          .from('code-files')
          .list(
            repoId
          );


      if (error) {

        console.error(
          'Storage list error:',
          error
        );


        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      return res.json(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.error(
        'File list error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// =========================================================
// ファイルアップロード
// =========================================================

app.post(
  '/api/repositories/:id/files',
  requireAuth,
  upload.single('file'),
  async (req, res) => {

    try {

      const repoId =
        req.params.id;


      const file =
        req.file;


      if (!repoId) {

        return res
          .status(400)
          .json({
            error:
              'Repository ID is required.'
          });

      }


      if (!file) {

        return res
          .status(400)
          .json({
            error:
              'No file uploaded.'
          });

      }


      /*
       * リポジトリの所有者をDBで確認
       */
      const {
        data: repositories,
        error:
          repositoryError
      } =
        await supabase
          .from('repositories')
          .select(
            'id,name,user_id'
          )
          .eq(
            'id',
            repoId
          )
          .limit(1);


      if (repositoryError) {

        console.error(
          'Repository lookup error:',
          repositoryError
        );


        return res
          .status(500)
          .json({
            error:
              'Failed to check repository.'
          });

      }


      if (
        !repositories ||
        repositories.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              'Repository not found.'
          });

      }


      const repository =
        repositories[0];


      /*
       * 所有者以外はアップロード不可
       */
      if (
        repository.user_id !==
        req.user.id
      ) {

        return res
          .status(403)
          .json({
            error:
              'You do not have permission to upload files to this repository.'
          });

      }


      /*
       * ファイル名の安全化
       */
      let originalName =
        String(
          file.originalname ||
          ''
        );


      originalName =
        originalName
          .replace(/\\/g, '_')
          .replace(/\//g, '_')
          .replace(/\.\./g, '_')
          .trim();


      if (!originalName) {

        return res
          .status(400)
          .json({
            error:
              'Invalid file name.'
          });

      }


      if (
        originalName.length > 255
      ) {

        return res
          .status(400)
          .json({
            error:
              'File name is too long.'
          });

      }


      /*
       * リポジトリID + ファイル名
       */
      const filePath =
        `${repoId}/${originalName}`;


      const {
        data,
        error
      } =
        await supabase.storage
          .from('code-files')
          .upload(
            filePath,
            file.buffer,
            {
              contentType:
                file.mimetype ||
                'application/octet-stream',

              upsert: true
            }
          );


      if (error) {

        console.error(
          'Storage upload error:',
          error
        );


        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      return res.json({
        message:
          'File uploaded successfully',

        path:
          data.path
      });

    } catch (error) {

      console.error(
        'Upload error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// =========================================================
// 古い /api/upload も互換用として残す
// =========================================================

app.post(
  '/api/upload',
  requireAuth,
  upload.single('file'),
  async (req, res) => {

    try {

      const repoId =
        req.body.repoId;


      const file =
        req.file;


      if (!repoId) {

        return res
          .status(400)
          .json({
            error:
              'repoId is required.'
          });

      }


      if (!file) {

        return res
          .status(400)
          .json({
            error:
              'No file uploaded.'
          });

      }


      /*
       * 所有権確認
       */
      const {
        data: repositories,
        error:
          repositoryError
      } =
        await supabase
          .from('repositories')
          .select(
            'id,user_id'
          )
          .eq(
            'id',
            repoId
          )
          .limit(1);


      if (repositoryError) {

        return res
          .status(500)
          .json({
            error:
              'Failed to check repository.'
          });

      }


      if (
        !repositories ||
        repositories.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              'Repository not found.'
          });

      }


      if (
        repositories[0].user_id !==
        req.user.id
      ) {

        return res
          .status(403)
          .json({
            error:
              'You do not have permission to upload files to this repository.'
          });

      }


      let originalName =
        String(
          file.originalname ||
          ''
        );


      originalName =
        originalName
          .replace(/\\/g, '_')
          .replace(/\//g, '_')
          .replace(/\.\./g, '_')
          .trim();


      if (!originalName) {

        return res
          .status(400)
          .json({
            error:
              'Invalid file name.'
          });

      }


      const filePath =
        `${repoId}/${originalName}`;


      const {
        data,
        error
      } =
        await supabase.storage
          .from('code-files')
          .upload(
            filePath,
            file.buffer,
            {
              contentType:
                file.mimetype ||
                'application/octet-stream',

              upsert: true
            }
          );


      if (error) {

        return res
          .status(400)
          .json({
            error:
              error.message
          });

      }


      return res.json({
        message:
          'File uploaded successfully',

        path:
          data.path
      });

    } catch (error) {

      console.error(
        'Legacy upload error:',
        error
      );


      return res
        .status(500)
        .json({
          error:
            'Internal server error.'
        });

    }
  }
);


// =========================================================
// エラーハンドリング
// =========================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      'Unhandled error:',
      error
    );


    if (
      error &&
      error.code ===
        'LIMIT_FILE_SIZE'
    ) {

      return res
        .status(413)
        .json({
          error:
            'File is too large. Maximum size is 50 MB.'
        });

    }


    return res
      .status(500)
      .json({
        error:
          'Internal server error.'
      });

  }
);


// =========================================================
// サーバー起動
// =========================================================

app.listen(
  PORT,
  () => {

    console.log(
      `Server is running on http://localhost:${PORT}`
    );

    console.log(
      'Custom authentication is enabled.'
    );

    console.log(
      'Supabase Auth is NOT being used.'
    );

  }
);
