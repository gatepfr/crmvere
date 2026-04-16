import { db } from "../db/index";
import { tenants, users, municipes, demandas, statusEnum } from "../db/schema";
import bcrypt from "bcryptjs";

async function seedTestData() {
  console.log("🌱 Iniciando seed de dados para Apucarana...");
  
  try {
    // 1. Criar um Gabinete
    const [tenant] = await db.insert(tenants).values({
      name: "Vereador Apucarana",
      slug: "apucarana",
      municipio: "Apucarana",
      uf: "PR",
      partido: "Partido de Teste",
      mandato: "2025-2028"
    }).returning();

    console.log(`✅ Gabinete criado: ${tenant.name} (${tenant.id})`);

    // 2. Criar um Usuário Admin para o Gabinete
    const passwordHash = await bcrypt.hash("admin123", 12);
    await db.insert(users).values({
      email: "admin@apucarana.com",
      passwordHash: passwordHash,
      role: "admin",
      tenantId: tenant.id
    });

    console.log("✅ Usuário admin criado: admin@apucarana.com / admin123");

    // 3. Criar Munícipes e Demandas nos Bairros Solicitados
    const testData = [
      { name: "Carlos Oliveira", bairro: "Jardim Interlagos", categoria: "Infraestrutura", resumo: "Buraco na rua principal próximo ao mercado." },
      { name: "Maria Santos", bairro: "Jardim Interlagos", categoria: "Saúde", resumo: "Falta de médico no posto de saúde local." },
      { name: "José Pereira", bairro: "Jardim Ponta Grossa", categoria: "Iluminação", resumo: "Lâmpada queimada no poste em frente ao número 150." },
      { name: "Ana Paula", bairro: "Centro", categoria: "Segurança", resumo: "Solicitação de maior policiamento na praça central." },
      { name: "Ricardo Souza", bairro: "Jardim Menegazzo", categoria: "Educação", resumo: "Vaga em creche para criança de 2 anos." },
      { name: "Fernanda Lima", bairro: "Centro", categoria: "Infraestrutura", resumo: "Calçada danificada impedindo passagem de pedestres." }
    ];

    for (const data of testData) {
      const [municipe] = await db.insert(municipes).values({
        tenantId: tenant.id,
        name: data.name,
        phone: `439${Math.floor(Math.random() * 90000000 + 10000000)}`,
        bairro: data.bairro
      }).returning();

      await db.insert(demandas).values({
        tenantId: tenant.id,
        municipeId: municipe.id,
        categoria: data.categoria,
        status: "nova",
        prioridade: Math.random() > 0.5 ? "alta" : "media",
        descricao: data.resumo
      });
    }

    console.log("✅ 6 Demandas de teste inseridas com sucesso!");
    console.log("\n🚀 DADOS DE ACESSO:");
    console.log("URL: http://localhost:5173");
    console.log("Login: admin@apucarana.com");
    console.log("Senha: admin123");

  } catch (error) {
    console.error("❌ Falha no seed:", error);
  } finally {
    process.exit(0);
  }
}

seedTestData();
