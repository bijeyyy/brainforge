import bcrypt from "bcryptjs";

async function generateHash() {
  const hash = await bcrypt.hash("611226", 12);
  console.log(hash);
}

generateHash();