const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("redis");
const {
  Serialize,
  isDateValid,
  ValidaBodyPostPessoa,
  isNullorUndefined,
} = require("./utils");
const { v4: uuidv4 } = require("uuid");
const app = express();
require("dotenv").config();

const pool = new Pool({
  host: "db",
  database: "postgres",
  user: "postgres",
  password: "123456",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const clientRedis = createClient({
  url: `redis://redis:6379/`,
});
clientRedis.connect();

// Variables
const port = process.env.PORT_API;
//-------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//--------------------------------------

app.use("/", (req, res, next) => {
  console.log("Monitor: " + req.url);
  next();
});

async function consultaViaCached(chave) {
  const busca = await clientRedis.get(chave);
  if (busca == null) {
    return null;
  } else {
    const response = JSON.parse(busca);
    if (response.data) {
      const buscaMapeada = response.data.map((ele) => {
        return Serialize(ele);
      });
      return buscaMapeada;
    }
    return Serialize(response);
  }
}

async function gravarCached(chave, valor) {
  return clientRedis.set(
    chave,
    Array.isArray(valor)
      ? JSON.stringify({ data: valor })
      : JSON.stringify(Serialize(valor))
  );
}

app.get("/contagem-pessoas", async (req, res) => {
  const contador = await pool.query(`SELECT 1 FROM pessoas`, []);
  return res.status(200).json({ total: contador.rowCount });
});

app.get("/pessoas/:id", async (req, res) => {
  let codigo = req.params.id;

  if (isNullorUndefined(codigo)) {
    return res.status(404).send();
  }

  const consultaRedis = await consultaViaCached(codigo);

  if (consultaRedis != null) {
    console.log("Consulta via cached");
    return res.status(200).json(consultaRedis);
  }

  console.log("Consulta via base de dados");
  const consultaID = await pool.query(`SELECT * FROM pessoas WHERE id = $1`, [
    codigo,
  ]);

  if (consultaID.rowCount == 0) {
    return res.status(404).send();
  } else {
    gravarCached(codigo, consultaID.rows[0]);
    return res.status(200).json(Serialize(consultaID.rows[0]));
  }
});

app.get("/pessoas", async (req, res) => {
  var termoBuscado = req.query.t;

  if (isNullorUndefined(termoBuscado)) {
    return res.status(400).send();
  }

  const consultaTermo = await consultaViaCached(termoBuscado);
  if (consultaTermo != null) {
    console.log("Termo buscado via cached");
    return res.status(200).json(consultaTermo);
  }

  console.log("Termo buscado via banco");
  const consultaGeral = await pool.query(
    `SELECT * FROM pessoas WHERE search_vector LIKE $1 LIMIT 50`,
    ["%" + String(termoBuscado).toLowerCase() + "%"]
  );

  if (consultaGeral.rowCount > 0) {
    gravarCached(termoBuscado, consultaGeral.rows);
    const valores = consultaGeral.rows.map((element) => {
      return Serialize(element);
    });

    return res.status(200).json(valores);
  } else {
    return res.status(200).json([]);
  }
});

app.post("/pessoas", async (req, res) => {
  let corpo = req.body;
  if (corpo == undefined || corpo == {}) {
    return res.status(422).send();
  }

  if (!ValidaBodyPostPessoa(corpo)) {
    return res.status(422).send();
  }

  // Checa o formato da data
  let match = /^(\d{4})\-(\d{2})\-(\d{2})$/.exec(corpo.nascimento);
  if (!match) {
    return res.status(422).send();
  } else {
    let ano = parseInt(match[1]);
    let mes = parseInt(match[2]);
    let dia = parseInt(match[3]);

    if (!isDateValid(`${ano}/${mes}/${dia}`)) {
      return res.status(422).send();
    }
  }

  // Valida o campo da stack
  if (!isNullorUndefined(corpo.stack)) {
    if (!Array.isArray(corpo.stack)) {
      return res.status(422).send();
    }

    const erroStack = corpo.stack.every((ele) => {
      if (typeof ele !== "string" || ele == "" || ele.length > 32) {
        return false;
      }
      return true;
    });
    if (!erroStack) {
      return res.status(422).send();
    }
  }

  const consultaApelido = await pool.query(
    `SELECT 1 FROM pessoas WHERE apelido LIKE $1`,
    ["%" + corpo.apelido + "%"]
  );

  if (consultaApelido.rowCount > 0) {
    return res.status(422).send();
  }

  let uuid = uuidv4();
  let novoCadastro = {
    id: uuid,
    apelido: corpo.apelido,
    nome: corpo.nome,
    nascimento: corpo.nascimento,
    stack: corpo.stack,
  };

  gravarCached(novoCadastro.id, novoCadastro);

  const text =
    "INSERT INTO pessoas(id, apelido, nome, nascimento, stack, search_vector) VALUES($1, $2, $3, $4, $5, $6) RETURNING *";
  const values = [
    novoCadastro.id,
    novoCadastro.apelido,
    novoCadastro.nome,
    novoCadastro.nascimento,
    novoCadastro.stack,
    String(novoCadastro.apelido).toLowerCase() +
      String(novoCadastro.nome).toLowerCase() +
      (novoCadastro.stack != undefined
        ? String(novoCadastro.stack).toString().toLowerCase()
        : ""),
  ];

  const registroSalvo = await pool.query(text, values);
  console.log("Registro afetados: " + registroSalvo.rowCount);
  return res.status(201).location(`/pessoas/${uuid}`).json(novoCadastro);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
