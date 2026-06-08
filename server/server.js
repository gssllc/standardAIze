const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Express server is running!");
});

app.get("/api/landingPage", (req, res) => {
    res.json({ 
        message: "",
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});