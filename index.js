require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jose = require("jose");
const moment = require("moment");
const axios = require("axios");
const allowedOrigins = process.env.ALLOWED_ORIGINS || ["http://localhost:3000"];
const PORT = 7000;
const clientId = process.env.SINGPASS_CLIENT_ID;
const spBackendUrl = process.env.SINGPASS_API_BACKEND_URL;
const jwksObject = JSON.parse(
  Buffer.from(process.env.JWKS_OBJECT || "e30=", "base64").toString()
);
const sigAlg = "ES256";
const encAlg = "ECDH-ES+A256KW";
const sigKeyId = "sig-20240322";
const encKeyId = "enc-20240322";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin
    // (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(null, false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

app.get("/login", (req, res) => {
  console.log("/login");
  try {
    console.log(req.query);
    console.log(req.headers);
    const { callbackUrlPath, sessionId } = req.query;
    const { origin } = req.headers;
    const authUrl = `${spBackendUrl}/auth`;
    const queryParams = {
      scope: "openid",
      response_type: "code",
      redirect_uri: `${origin}${callbackUrlPath}`,
      state: sessionId,
      nonce: sessionId,
      client_id: clientId,
    };
    const spUrl = `${authUrl}?${new URLSearchParams(queryParams)}`;
    return res.status(200).send(spUrl);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).send("login error");
  }
});

app.get("/token", async (req, res) => {
  console.log("/token");
  const result = {};
  try {
    const { callbackUrlPath, code } = req.query;
    const { origin } = req.headers;
    async function generateClientAssertion() {
      const pkVal = await jose.importJWK(jwksObject.private, sigAlg);
      const futureTime = moment().add(1, "minutes");
      const protectedHeaders = {
        typ: "JWT",
        alg: sigAlg,
        kid: sigKeyId,
      };
      const assertion = await new jose.SignJWT({
        sub: clientId,
        iss: clientId,
        aud: spBackendUrl,
        iat: moment().unix(),
        exp: futureTime.unix(),
      })
        .setProtectedHeader(protectedHeaders)
        .sign(pkVal);
      return assertion;
    }

    const assertion = await generateClientAssertion();
    const tokenUrl = `${spBackendUrl}/token`;
    const params = {
      grant_type: "authorization_code",
      code: code,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      client_id: clientId,
      redirect_uri: `${origin}${callbackUrlPath}`,
    };
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const response = await axios.post(tokenUrl, params, { headers });
    return res.status(200).send(response.data);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).send("token error");
  }
});

app.post("/decodeToken", async (req, res) => {
  console.log("/decodeToken");
  try {
    const { id_token } = req.body;
    const pkVal = await jose.importJWK(jwksObject.private, encAlg);
    const { plaintext, protectedHeader } = await jose.compactDecrypt(
      id_token,
      pkVal
    );
    const bodyToConvert = new TextDecoder().decode(plaintext);
    let result = await jose.decodeJwt(bodyToConvert);
    const [sid, uuid] = result.sub.split(",");
    const data = {
      sid: sid.substring(sid.indexOf("=") + 1, sid.length),
      uuid: uuid.substring(uuid.indexOf("=") + 1, uuid.length),
    };
    return res.status(200).send(data);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).send("decode error");
  }
});

app.get("/jwks", (req, res) => {
  try {
    const { public } = jwksObject;
    const finalObj = {
      keys: [
        {
          kid: sigKeyId,
          use: "sig",
          alg: sigAlg,
          ...public,
        },
        {
          kid: encKeyId,
          use: "enc",
          alg: encAlg,
          ...public,
        },
      ],
    };
    return res.status(200).send(finalObj);
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).send({});
  }
});

app.get("/test", async (req, res) => {
  const result = {};
  try {
    const { body, headers, method, params, query, session } = req;
    console.log(1, body);
    console.log(2, headers);
    console.log(3, method);
    console.log(4, params);
    console.log(5, query);
    console.log("envs", allowedOrigins);
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
