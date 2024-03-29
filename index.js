const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());
const PORT = 7000;
const cors = require("cors");

const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};
app.use(cors(corsOptions));

app.get("/test", async (req, res) => {
  const result = {};
  try {
    const { body, headers, method, params, query } = req;
    console.log(1, body);
    console.log(2, headers);
    console.log(3, method);
    console.log(4, params);
    console.log(5, query);
    console.log("envs", JSON.stringify(process.env));
    result.status = 200;
    result.body = { data: "success" };
  } catch (error) {
    console.error(error.message);
    result.status = error.response?.status || 500;
    result.body = error.response?.data;
  }
  return res.status(result.status).send(result.body);
});

app.get("*", (req, res) => {
  return res.status(404).send({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`listening port: ${PORT}`);
});
