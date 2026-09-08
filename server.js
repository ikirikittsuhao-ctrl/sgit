require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 1. リポジトリ作成 API
app.post('/api/repositories', async (req, res) => {
  const { name, description, userId } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ error: 'Repository name and userId are required.' });
  }

  const { data, error } = await supabase
    .from('repositories')
    .insert([{ name, description, user_id: userId }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// 2. リポジトリ一覧取得 API
app.get('/api/repositories', async (req, res) => {
  const { data, error } = await supabase
    .from('repositories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { repoId } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!repoId) return res.status(400).json({ error: 'repoId is required.' });

  const filePath = `${repoId}/${file.originalname}`;

  const { data, error } = await supabase.storage
    .from('code-files')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'File uploaded successfully', path: data.path });
});

app.get('/api/repositories/:id/files', async (req, res) => {
  const repoId = req.params.id;

  const { data, error } = await supabase.storage
    .from('code-files')
    .list(repoId);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
