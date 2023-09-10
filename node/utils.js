function Serialize(value) {
  return {
    id: value.id,
    apelido: value.apelido,
    nome: value.nome,
    nascimento: formatDate(value.nascimento),
    stack: value.stack,
  };
}

function formatDate(date = new Date()) {
  const year = date.toLocaleString("default", { year: "numeric" });
  const month = date.toLocaleString("default", {
    month: "2-digit",
  });
  const day = date.toLocaleString("default", { day: "2-digit" });
  return year;
}

function isDateValid(dateStr) {
  return !isNaN(new Date(dateStr));
}

function isNullorUndefined(value) {
  return value == undefined || value == null;
}

function ValidaBodyPostPessoa(bodyRequest) {
  return (
    !isNullorUndefined(bodyRequest.apelido) &&
    !isNullorUndefined(bodyRequest.nome) &&
    !isNullorUndefined(bodyRequest.nascimento) &&
    typeof bodyRequest.nome === "string" &&
    String(bodyRequest.apelido).length <= 32 &&
    String(bodyRequest.nome).length <= 100
  );
}

module.exports = {
  Serialize,
  formatDate,
  isDateValid,
  ValidaBodyPostPessoa,
  isNullorUndefined,
};
