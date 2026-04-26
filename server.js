const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "news.json");

app.use(express.json());
app.use(express.static(__dirname));

app.get("/news", async (req, res) => {
  try {
    const news = await readNews();
    res.json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/news", async (req, res) => {
  try {
    const news = await readNews();
    const { title, category, content, image } = req.body;

    if (!title || !category || !content || !image) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const nextId = getNextId(news);
    const newItem = {
      id: nextId,
      title: title.trim(),
      category: category.trim(),
      date: currentDate(),
      content: content.trim(),
      image: image.trim()
    };

    news.push(newItem);
    await writeNews(news);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/news/:id", async (req, res) => {
  try {
    const news = await readNews();
    const id = Number(req.params.id);
    const index = news.findIndex((item) => Number(item.id) === id);

    if (index === -1) {
      return res.status(404).json({ message: "News item not found." });
    }

    const { title, category, content, image } = req.body;
    if (!title || !category || !content || !image) {
      return res.status(400).json({ message: "All fields are required." });
    }

    news[index] = {
      ...news[index],
      title: title.trim(),
      category: category.trim(),
      content: content.trim(),
      image: image.trim(),
      date: currentDate()
    };

    await writeNews(news);
    res.json(news[index]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/news/:id", async (req, res) => {
  try {
    const news = await readNews();
    const id = Number(req.params.id);
    const updatedNews = news.filter((item) => Number(item.id) !== id);

    if (updatedNews.length === news.length) {
      return res.status(404).json({ message: "News item not found." });
    }

    await writeNews(updatedNews);
    res.json({ message: "News deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`News admin server running on http://localhost:${PORT}`);
});

async function readNews() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const data = raw.trim() ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      const sample = [];
      await writeNews(sample);
      return sample;
    }
    throw error;
  }
}

async function writeNews(news) {
  await fs.writeFile(DATA_FILE, `${JSON.stringify(news, null, 2)}\n`, "utf8");
}

function getNextId(news) {
  return news.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function currentDate() {
  return new Date().toISOString().split("T")[0];
}
