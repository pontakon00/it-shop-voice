# ShopVoice (it-shop-voice)

> ผู้ช่วยช้อปปิ้งออนไลน์ที่สั่งงานด้วยเสียงภาษาไทย — พูดชื่อสินค้าที่ต้องการ
> ระบบจะค้นหา แสดงผล และเพิ่มลงตะกร้าให้โดยอัตโนมัติ
>
> **ถ้าค้นไม่พบสินค้า ระบบจะส่งคำถามต่อไปหา n8n → Groq AI เพื่อช่วยตอบแทน**
> โดยไม่ hardcode คำตอบไว้ในเว็บ

โปรเจกต์นี้สาธิตแนวคิด **Voice Commerce** ครบวงจร ตั้งแต่รับเสียง → ตีความคำสั่ง
→ ค้นสินค้าในฐานข้อมูล → จัดการตะกร้า และมี AI Layer สำรองเมื่อคำถามอยู่นอกขอบเขตของระบบ

---

## สถาปัตยกรรม

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React 19 + TypeScript)                         │
│  🎙 Web Speech API (th-TH) → พิมพ์คำสั่งได้ / ถามด้วยข้อความ │
└────────────────────────────┬─────────────────────────────┘
                             │ POST /api/voice
┌────────────────────────────▼─────────────────────────────┐
│  Next.js 16 (App Router + Route Handler)  ·  Node.js     │
│                                                          │
│  nlu.ts ── intent + entity (query, budget, sort, qty)     │
│     │                                                    │
│     ├── productRepository.ts ──┬── MySQL 8 (docker)     │
│     │                          └── products.json fallback│
│     │                                                    │
│     ├── matching.ts ── fuzzy score + filter + sort       │
│     │                                                    │
│     └── aiFallback.ts ── ถ้าไม่พบสินค้า ────────────┐    │
│     │          ▲ ส่ง profile + systemPrompt ไปด้วย  │    │
└─────┼───────────────────────────────────────────────┼────┘
      │ พบสินค้า                                    │ ไม่พบสินค้า
      ▼                                               ▼
  source: "database" | "json"                 ┌──────────────────┐
 คะแนน + เหตุผลที่ตรงกัน                    │  n8n (Webhook)   │
                                             │  Build Prompt    │
                                             │      ↓           │
                                             │  Groq API        │
                                             │  llama-3.3-70b   │
                                             │      ↓           │
                                             │  Parse Answer    │
                                             │      ↓           │
                                             │  Respond JSON    │
                                             └──────────────────┘
                                                        │
                                             source: "ai"
                                             answer + suggestions
```

### หลักการสำคัญ

| หลักการ | รายละเอียด |
| --- | --- |
| **Degrade gracefully** | ทุกชั้นมี fallback — ไม่มี MySQL → ใช้ JSON, ไม่มี n8n → ตอบแบบไม่มี AI, n8n ล่ม/timeout → คืนคำแนะนำกลับ (ไม่ทำให้ route พัง) |
| **ไม่มี secret ในเว็บ** | `GROQ_API_KEY` อยู่ที่ n8n เท่านั้น เว็บเรียกแค่ URL ของ webhook |
| **Domain-agnostic** | prompt ไม่ได้อยู่ใน workflow แต่ถูกส่งมาจาก `assistantProfile.ts` เปลี่ยนโดเมน = แก้ไฟล์เดียว |
| **Stateless** | `/api/voice` ไม่มี session; ตะกร้าอยู่ฝั่ง client (`localStorage`) |

---

## คำสั่งเสียงที่รองรับ

| คำสั่ง | ตัวอย่าง | ผลลัพธ์ |
| --- | --- | --- |
| ค้นหาสินค้า | `อยากได้หูฟังไร้สาย` | แสดงสินค้าที่ตรงกับคำค้น |
| กรองตามราคา | `หาคีย์บอร์ดราคาไม่เกิน 4000` | กรองราคา ≤ 4,000 บาท |
| กรองตามหมวด | `จอคอม 4k` | เหลือเฉพาะหมวด display |
| เรียงลำดับ | `หูฟังราคาถูก` / `ของใหม่` | เรียงราคาต่ำ→สูง หรือวันที่ล่าสุด |
| เพิ่มลงตะกร้า | `เพิ่มหูฟัง TWS Pro ลงตะกร้า 2 ชิ้น` | เพิ่มพร้อมจำนวน |
| ลบออก | `เอาหูฟัง TWS Pro ออก` | ลบสินค้าออกจากตะกร้า |
| ดูตะกร้า | `ดูตะกร้า` | เปิด drawer ตะกร้า |
| สรุปราคา | `สรุปราคา` / `ชำระเงิน` | แสดงยอดรวม |
| ล้างตะกร้า | `ล้างตะกร้า` | ล้างรายการทั้งหมด |
| คำสั่งอื่น | `สวัสดี` / `ช่วยเหลือ` | ตอบกลับพร้อมคำแนะนำ |
| **นอกขอบเขต** | `อยากทำผัดกะเพรา` | ส่งต่อ n8n → Groq ตอบกลับ |

---

## การตีความคำสั่ง (NLU)

`src/lib/nlu.ts` เป็นตัวกำหนดเจตนา (intent) และดึงข้อมูลสำคัญ (entity) ออกจากประโยคพูด
ด้วยกฎ (rule-based) ไม่ใช้โมเดลภาษาขนาดใหญ่ ทำให้รันได้เร็วและไม่มีค่าใช้จ่าย

- **Intent** — เทียบข้อความกับชุด trigger แบบเรียงลำดับความยาว เพื่อให้
  `"ล้างตะกร้า"` ชนกฎ `clear` ก่อน `remove` และ `"ซื้อของ"` ชนกฎ `checkout` ก่อน `add`
- **Quantity** — รองรับเลขไทย (๑–๙), เลขอารบิก และคำไทย (`หนึ่ง`–`สิบ`) พร้อมหน่วย
  (`อัน`, `ชิ้น`, `ใบ`, `คู่` ฯลฯ) — งบต้องถูกแยกออกก่อนจำนวน ไม่งั้นเลขราคาจะถูกกินไป
- **Budget** — รับรูปแบบ `ไม่เกิน`, `ต่ำกว่า`, `ในงบ`, `มากกว่า`, `อย่างน้อย`
- **Category** — แปลงคำสำคัญเป็นหมวดสินค้า 9 หมวด (ป้ายหมวดทุกตัวใน `CATEGORY_LABELS`
  ต้องถูกรู้จักด้วย ไม่งั้นผู้ใช้พูดชื่อหมวดตามที่หน้าเว็บแสดงผลแล้วระบบจะหาไม่เจอ)
- **Sort** — `ถูกที่สุด`, `แพงที่สุด`, `ขายดี`, `ใหม่ล่าสุด`

## การจับคู่สินค้า

`src/lib/matching.ts` ให้คะแนนสินค้าแต่ละรายการจากหลายสัญญาณรวมกัน ได้แก่

1. ชื่อสินค้าตรงทั้งหมด / ตรงบางส่วน
2. คำสำคัญตรงทั้งหมด / สอดคล้องบางส่วน
3. แบรนด์ตรงกับคำค้น
4. **Dice coefficient บน bigram ตัวอักษร** — ทำให้คำที่พิมพ์ผิดหรือพูดไม่ครบ
   (เช่น `คย์บอร์ด` แทน `คีย์บอร์ด`) ยังหาสินค้าเจอ โดยไม่ต้องพึ่ง dictionary
   ของภาษาไทยที่ต้องตัดคำก่อน

เมื่อผู้ใช้สั่งซื้อ/สั่งลบ ระบบจะเลือกสินค้าที่คะแนนสูงสุดเท่านั้นเมื่อเกินเกณฑ์
`MIN_ADD_SCORE` ถ้าไม่ถึงเกณฑ์จะถามกลับแทนที่จะเดาสุ่ม

### ทำไมต้องมีทั้ง MySQL และ JSON

`productRepository.ts` กรองหมวด/งบ/สต็อกด้วย SQL เพื่อให้รองรับข้อมูลขนาดใหญ่
แล้วค่อยให้ `matching.ts` จัดอันดับซ้ำเฉพาะรายการที่ผ่านเงื่อนไข (จำกัด 500 แถว)
เมื่อไม่มี `DATABASE_URL` หรือต่อ DB ไม่ได้ ระบบจะ log เหตุผลแล้วใช้
`src/data/products.json` แทน โดย**ผลการค้นหาเหมือนกันทุกประการ**

---

## AI Fallback (n8n + Groq)

เมื่อคำค้นเป็นคำสั่ง `search` แต่ไม่พบสินค้า ระบบจะเรียก n8n หนึ่งครั้ง:

```jsonc
// POST ไปยัง N8N_WEBHOOK_URL
{
  "query": "จอคอม 4k",                        // คำค้นที่ NLU ทำความสะอาดแล้ว
  "transcript": "จอคอม 4k ราคาไม่เกิน 5000", // ประโยคเต็มของผู้ใช้
  "catalog": [                                // สินค้าที่ดึงมาจากฐานข้อมูลจริง
    {
      "name": "จอมอนิเตอร์ 27 นิ้ว 4K IPS",
      "category": "จอภาพ",
      "price": 12900,
      "stock": 5,
      "rating": 4.7
    }
  ],
  "profile": {
    "key": "it-shop",
    "domain": "ร้านขายอุปกรณ์ไอที...",
    "categories": ["เสียง", "คอมพิวเตอร์", "..."],
    "systemPrompt": "คุณคือผู้ช่วย AI ... ตอบเป็น JSON เท่านั้น ..."
  }
}
```

workflow `n8n/shopvoice-workflow.json` มี 5 จุด:

| โหนด | หน้าที่ |
| --- | --- |
| **Webhook** | รับ `{ query, transcript, catalog, profile }` |
| **Build Prompt** | ประกอบ `system` + `user` message จาก `profile` แล้วแทรก `CATALOG` (ไม่ hardcode โดเมน) |
| **Call Groq API** | `llama-3.3-70b-versatile`, `temperature 0.3`, `response_format: json_object` — ยิงผ่าน HTTP Request node ที่ใช้ Header Auth credential |
| **Parse Answer** | แกะ JSON → `{ answer, suggestions }` |
| **Respond to Webhook** | คืน `{ answer, suggestions, model }` |

เว็บรับคำตอบมาแสดงเป็นการ์ด AI พร้อมป้ายบอกแหล่งที่มา (`source: "ai"`)
และมี timeout (ค่าเริ่มต้น 8 วินาที, ปรับด้วย `N8N_TIMEOUT_MS`) ถ้า n8n ล่ม
ระบบจะถือว่าไม่มี AI แล้วตอบแบบเดิม ไม่ทำให้หน้าเว็บพัง

> คำสั่งที่เป็น `add` / `remove` / `checkout` **จะไม่ถูกส่งให้ AI**
> เพราะ AI ไม่ควรตีความความหมายของตะกร้า — ให้ระบบถามกลับผู้ใช้แทน

### ทำไม AI ถึงไม่กุข้อมูล — CATALOG

โมเดลไม่ได้ตอบจากความจำของตัวเอง แต่ตอบจาก `catalog` ที่ระบบดึงจากฐานข้อมูลมาแนบให้
(`suggestProductsForAi` ใน `src/lib/productRepository.ts`)

จุดที่ต่างจาก `searchProducts` คือ **ตัดเงื่อนไขงบและหมวดออก** เพราะกรณีที่ค้นไม่เจอ
มักมาจาก "งบไม่ถึง" ไม่ใช่ไม่มีของ ผลที่เห็น:

| คำถาม | ก่อนมี CATALOG | หลังมี CATALOG |
| --- | --- | --- |
| `จอคอม 4k ราคาไม่เกิน 5000` | ไม่พบสินค้า | มีจอ 27 นิ้ว 4K ราคา 12,900 สต็อก 5 |
| `อยากทำผัดกะเพรา` | ไม่พบสินค้า | ไม่มีสินค้าที่ตรงกับคำถาม |

เคสที่สอง `catalog` จะว่างโดยอัตโนมัติ เพราะการจับคู่ให้คะแนน 0 ทุกรายการ
AI จึงตอบว่าไม่มีตามจริง แทนที่จะถูกยัดสินค้าไม่เกี่ยวข้องไปอ้าง

ชื่อสินค้าถูกส่งใน `user` message เท่านั้น **ไม่ใช่ `system` prompt**
เพราะข้อมูลจากฐานข้อมูลถือเป็น untrusted input — ถ้าอยู่ใน system prompt
ผู้ใช้ที่ตั้งชื่อสินค้าว่า `ignore previous instructions` ได้

> เรียกว่าเป็น RAG ได้ แต่ยังไม่ใช่ embedding — ใช้ Dice coefficient บน bigram
> ตัวอักษรที่มีอยู่แล้ว เพราะ 13 สินค้าไม่จำเป็นต้องมี vector store

### ทำไมต้องส่งทั้ง `query` และ `transcript`

NLU ตัดคำฟุ่มออกจนบริบทภาษาไทยหาย เช่น

```
"ช่วยแนะนำสูตรอาหารอร่อยๆ"  →  query: "สูตรอา รอร่อยๆ"
```

`query` ใช้จับคู่กับ CATALOG ส่วน `transcript` ให้โมเดลเข้าใจว่าผู้ใช้ต้องการอะไรจริง
Build Prompt จะใส่ทั้งสองบรรทัดพร้อมกัน และสั่งให้ตอบตามประโยคเต็ม

### หลักฐานว่า workflow เป็น Domain-Agnostic

คำถามนอกขอบเขตจะวิ่งผ่าน AI layer เหมือนกันทุกเคส:

```bash
curl -X POST http://localhost:3000/api/voice \
  -H "Content-Type: application/json" \
  -d '{"text":"อยากทำผัดกะเพรา"}'
```

```jsonc
{
  "intent": "search",
  "source": "ai",                    // ← ไม่ใช่ database/json
  "totalResults": 0,
  "aiAnswer": {
    "answer": "...",                // คำตอบจาก Groq
    "suggestions": ["...", "...", "..."]
  }
}
```

`systemPrompt` ยาว 777 ตัวอักษรที่ถูกส่งไปยัง Groq มาจาก `IT_SHOP_PROFILE`
ในฝั่งเว็บ ไม่ได้อยู่ใน workflow — ถ้าเปลี่ยนเป็น `RECIPE_SHOP_PROFILE`
AI จะเปลี่ยนบุคลิกทันทีโดยไม่ต้องแตะ workflow

### วิธีเปลี่ยนโดเมน

`src/lib/assistantProfile.ts` มี 2 โปรไฟล์:

| โปรไฟล์ | สถานะ | ใช้ทำอะไร |
| --- | --- | --- |
| `IT_SHOP_PROFILE` | ใช้งานจริง | ตัวอย่างงานจริง |
| `RECIPE_SHOP_PROFILE` | ตัวอย่าง | พิสูจน์ว่าโครงสร้างเดียวกันย้ายไปทำสินค้าอาหารได้ |

สลับใช้งานแก้บรรทัดเดียว:

```ts
export const ACTIVE_PROFILE = RECIPE_SHOP_PROFILE; // เปลี่ยนจาก IT_SHOP_PROFILE
```

---

## เทคโนโลยีที่ใช้

- **Next.js 16** (App Router, Route Handler) + **React 19**
- **TypeScript** แบบ strict
- **Node.js** เป็น runtime ของ server
- **MySQL 8** ผ่าน `mysql2` (ติดตั้งตรงเครื่อง หรือ Docker) + JSON fallback
- **n8n** เป็น AI orchestration workflow
- **Groq API** (`llama-3.3-70b-versatile`) ผ่าน n8n
- **Tailwind CSS 4** ผ่าน `@theme` token
- **Web Speech API** (`SpeechRecognition`) ภาษา `th-TH`
- **Dice coefficient** สำหรับ fuzzy matching
- `localStorage` สำหรับเก็บตะกร้า

---

## เริ่มใช้งาน

### เริ่มแบบเร็ว (ไม่ต้องมีฐานข้อมูล ไม่ต้องมี AI)

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) — ค้นหาได้จาก `products.json`

### เปิด MySQL — เลือกทางที่สะดวก

#### ทางที่ 1: ติดตั้งตรงเครื่อง (ไม่ต้องมี Docker)

```bash
winget install Oracle.MySQL --silent
```

ตัวติดตั้งแบบ silent จะวางไฟล์ไว้ที่ `C:\Program Files\MySQL\MySQL Server 8.4`
แต่จะ **ไม่** init data dir และ **ไม่** ลงทะเบียน Windows service (เพราะต้องใช้สิทธิ์
Administrator) ให้ทำเองดังนี้:

```powershell
# 1. สร้าง my.ini — bind-address จำกัดให้รับเฉพาะเครื่องนี้
$cfg = "C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"
@"
[mysqld]
basedir=C:/Program Files/MySQL/MySQL Server 8.4
datadir=C:/ProgramData/MySQL/MySQL Server 8.4/Data
port=3306
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone=+07:00
max_connections=100
log-error=C:/ProgramData/MySQL/MySQL Server 8.4/error.log

[client]
port=3306
default-character-set=utf8mb4
"@ | Set-Content -Path $cfg -Encoding UTF8

# 2. init data dir — ครั้งแรก root จะได้ password ว่าง (ขั้นตอนที่ 4 ไปตั้งให้)
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" `
    --defaults-file="$cfg" --initialize-insecure --console

# 3. สตาร์ทเซิร์ฟเวอร์ก่อน — mysql.exe จะเชื่อมต่อได้ก็ต่อเมื่อเซิร์ฟเวอร์รันแล้ว
#    คำสั่งนี้จะรันค้างไว้ ให้เปิดเทอร์มินัลใหม่ไปทำขั้นตอนที่ 4-5 ต่อ
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="$cfg" --console
```

> ลำดับสำคัญ: `mysql.exe` เชื่อมต่อไม่ได้จนกว่า `mysqld` จะรันอยู่
> ถ้าได้ `ERROR 2002 (Can't connect)` แปลว่ายังไม่ได้รันขั้นตอนที่ 3

เปิดเทอร์มินัลใหม่:

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"

# 4. ตั้งรหัสผ่าน root + สร้าง user สำหรับแอป
#    สร้างเป็น 'localhost' เท่านั้น เพราะ bind-address ไม่ให้เข้าจากเครื่องอื่นอยู่แล้ว
& $mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'change-me-root';"
& $mysql -u root -pchange-me-root -e @"
CREATE USER IF NOT EXISTS 'shopvoice'@'localhost' IDENTIFIED BY 'shopvoice';
GRANT ALL PRIVILEGES ON shopvoice.* TO 'shopvoice'@'localhost';
FLUSH PRIVILEGES;
"@

# 5. โหลด schema + seed
& $mysql -u root -pchange-me-root --default-character-set=utf8mb4 `
    -e "source C:/path/to/repo/db/schema.sql"
& $mysql -u root -pchange-me-root --default-character-set=utf8mb4 `
    -e "source C:/path/to/repo/db/seed.sql"
```

> เปลี่ยน `change-me-root` เป็นรหัสผ่านของคุณก่อนใช้งานจริง
> ใส่รหัสผ่านต่อท้าย `-p` แบบนี้เพื่อความสั้นในเอกสารเท่านั้น — เวลาใช้งานจริงควรพิมพ์รหัสผ่านเอง
> MySQL จะขึ้นเตือนเรื่อง password บน command line ซึ่งเป็นเรื่องปกติ

ตั้งค่า `DATABASE_URL` ใน `.env.local` ให้ตรงกับ user ที่สร้าง:

```bash
DATABASE_URL="mysql://shopvoice:shopvoice@localhost:3306/shopvoice"
```

> ถ้าต้องการให้ MySQL เปิดอัตโนมัติทุกครั้งที่เปิดเครื่อง ให้รัน PowerShell
> **แบบ Administrator** ครั้งเดียว:
> `mysqld --install MySQL84 --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"`
> แล้ว `Start-Service MySQL84`

#### ทางที่ 2: Docker

```bash
docker compose up -d
```

`docker-compose.yml` จะสร้าง MySQL 8.4 พร้อม mount `db/schema.sql` และ `db/seed.sql`
เข้า `products` 13 รายการอัตโนมัติ (root password คือ `rootpassword` ต่างจากทางที่ 1)

#### ตั้งค่าแอป

```bash
cp .env.example .env.local
```

`db/schema.sql` มี `CREATE DATABASE IF NOT EXISTS shopvoice` อยู่แล้ว
จึงไม่ต้องสร้างฐานข้อมูลเอง

### เปิด n8n + Groq (ไม่ต้องใช้ Docker)

n8n เป็น Node application จึงรันตรงได้เลย:

```bash
npm install -g n8n
n8n
```

> n8n 2.x จะขึ้นหน้า **สร้าง owner account** ในครั้งแรก (อีเมล + รหัสผ่าน) ให้กรอกก่อนเข้า editor
> ถ้าไม่อยากมี login บนเครื่อง dev ให้รันด้วย `$env:N8N_USER_MANAGEMENT_DISABLED="true"; n8n`
>
> ต้องรอให้เห็นบรรทัด `Editor is now accessible via http://localhost:5678`
> ก่อนเปิดเบราว์เซอร์ (ใช้เวลา 10-20 วินาที) ถ้าเปิดเร็วเกินไปจะเจอ `Cannot GET /`
> เพราะ frontend ยังไม่ได้ mount เสร็จ — ไม่ใช่ติดตั้งผิด

1. เปิด [http://localhost:5678](http://localhost:5678)
2. **Workflows → Import from File** เลือก `n8n/shopvoice-workflow.json`
3. สร้าง credential สำหรับ Groq (ขั้นตอนเดียวที่ต้องทำเอง เพราะต้องใช้ API key ของคุณ):
   - **Credentials → New Credential → Header Auth**
   - Name: `Groq API`
   - Header Name: `Authorization`
   - Header Value: `Bearer gsk_xxxxxxxx` (ขอคีย์ฟรีได้ที่ [console.groq.com/keys](https://console.groq.com/keys))
4. เปิด workflow → คลิก node **Call Groq API** → เลือก credential `Groq API`
   (หลัง import โหนดนี้จะขึ้นเตือนว่า credential หายไป เพราะ credential เป็นของแต่ละ instance
   และไม่ถูก export ไปพร้อมไฟล์ workflow)
5. กด **Publish** แล้วเอา URL ที่ขึ้นมา (รูปแบบ `http://localhost:5678/webhook/...`) ใส่ `N8N_WEBHOOK_URL` ใน `.env.local`
6. `npm run dev` ใหม่

> ระบบใช้ n8n Credentials แทนการอ่าน `$env.GROQ_API_KEY` เพราะ n8n 2.x
> บล็อกการอ่าน env var ใน node โดยค่าเริ่มต้น — วิธีนี้จึงไม่ต้องปิด security
> และคีย์ไม่หลุดไปกับไฟล์ที่ commit ขึ้น Git

### ตรวจว่าทุกชั้นทำงาน

```bash
curl http://localhost:3000/api/products   # ดูว่า source เป็น "database" แล้วหรือยัง
```

`source` จะบอกว่าตอนนั้นระบบดึงข้อมูลจากไหน: `database` (MySQL), `json` (fallback),
หรือ `ai` (คำตอบจาก Groq)

> **การตัดเสียงต้องใช้ Chrome หรือ Edge** เพราะเบราว์เซอร์อื่นยังไม่รองรับ
> `SpeechRecognition` หากใช้เบราว์เซอร์ที่ไม่รองรับ ระบบจะแจ้งเตือนและเปิดให้
> พิมพ์คำสั่งด้วยมือแทนอัตโนมัติ

คำสั่งอื่น ๆ:

```bash
npm run build   # build สำหรับ production
npm run start   # รัน production server
npm run lint    # ตรวจ lint
```

---

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── layout.tsx              # metadata + font ไทย/ละติน
│   ├── page.tsx                # หน้าหลัก (client) ประกอบทุกส่วน
│   ├── globals.css             # Tailwind 4 + design tokens
│   └── api/
│       ├── voice/route.ts      # POST /api/voice — endpoint หลัก
│       └── products/route.ts   # GET /api/products — รายการสินค้า + source
├── components/
│   ├── VoicePanel.tsx          # ปุ่มไมโครโฟน + สถานะการฟัง
│   ├── ConversationLog.tsx     # ประวัติสนทนา
│   ├── ProductCard.tsx         # การ์ดสินค้า
│   ├── CartDrawer.tsx          # ตะกร้าแบบ slide-over
│   ├── CheckoutSummary.tsx     # สรุปคำสั่งซื้อ
│   ├── SuggestionChips.tsx     # คำสั่งตัวอย่าง
│   ├── SourceBadge.tsx         # ป้ายบอกแหล่งที่มา (database / json / ai)
│   └── AiAnswerCard.tsx        # การ์ดคำตอบจาก Groq
├── hooks/
│   ├── useSpeechRecognition.ts # wrapper Web Speech API
│   └── useCart.ts              # state ตะกร้า + localStorage
├── lib/
│   ├── types.ts                # TypeScript types ทั้งหมด
│   ├── nlu.ts                  # intent + entity parsing
│   ├── matching.ts             # fuzzy scoring, filter, sort
│   ├── catalog.ts              # JSON catalog + static exports
│   ├── db.ts                   # MySQL pool + row mapping
│   ├── productRepository.ts    # MySQL query + JSON fallback
│   ├── aiFallback.ts           # n8n webhook client
│   ├── assistantProfile.ts     # โปรไฟล์โดเมน (IT shop / recipe)
│   ├── cartStore.ts            # ตะกร้าฝั่ง server
│   └── speech.ts               # helper สำหรับ Web Speech API
└── data/
    └── products.json           # catalog สินค้า 13 รายการ (fallback)

db/
├── schema.sql                  # โครงสร้างตาราง products
└── seed.sql                    # ข้อมูล 13 รายการ
n8n/
└── shopvoice-workflow.json     # workflow สำหรับ import เข้า n8n
docker-compose.yml              # MySQL 8.4 สำหรับ dev
```

---

## API

### `POST /api/voice`

```json
{ "text": "หาคีย์บอร์ดราคาไม่เกิน 4000" }
```

**Response (ค้นพบสินค้า)**

```jsonc
{
  "transcript": "หาคีย์บอร์ดราคาไม่เกิน 4000",
  "intent": "search",
  "reply": "พบ 2 รายการที่ตรงกับ \"คีย์บอร์ด\" (ราคาไม่เกิน 4,000 บาท, หมวดคอมพิวเตอร์) ...",
  "confidence": 0.75,
  "query": "คีย์บอร์ด",
  "quantity": 0,
  "budget": { "max": 4000 },
  "sort": "relevance",
  "source": "database",         // หรือ "json"
  "results": [
    {
      "product": { "id": "kbd-75", "name": "คีย์บอร์ดไร้สาย KBD-75", "price": 3290 },
      "score": 85,
      "reasons": ["ตรงกับคำสำคัญ \"คีย์บอร์ด\""]
    }
  ],
  "totalResults": 2,
  "suggestion": ["เพิ่ม คีย์บอร์ดไร้สาย KBD-75 ลงตะกร้า", "ดูตะกร้า", "สรุปราคา"]
}
```

**Response (ไม่พบสินค้า → AI Fallback)**

```jsonc
{
  "intent": "search",
  "reply": "ในร้านนี้ยังไม่มีสินค้าที่ตรงกับคำถามครับ ...",
  "source": "ai",
  "results": [],
  "totalResults": 0,
  "aiAnswer": {
    "answer": "...",
    "suggestions": ["...", "...", "..."],
    "model": "llama-3.3-70b-versatile"
  }
}
```

`GET` จะตอบ `405 Method Not Allowed` โดยตั้งเจตนาผิด method เป็น `POST`

### `GET /api/products`

```bash
curl http://localhost:3000/api/products
```

คืน `source` (`database` | `json`), `total` และ `products` ทั้งหมด
ใช้ตรวจว่าเชื่อมต่อฐานข้อมูลสำเร็จหรือยัง

### กฎการทำงาน

- ข้อความว่าง → `200` พร้อมข้อความแนะนำ (ไม่ error เพื่อให้ UI เรียกได้ตลอด)
- ข้อความยาวเกิน 200 ตัวอักษร → ตัดและแนะนำให้พูดสั้นลง
- หน้า `/api/voice` ทำงานแบบ stateless — ตะกร้าอยู่ฝั่ง client

---

## ผลการตรวจสอบ

รันจริงด้วย `next start` โดยทดสอบทีละชั้น — JSON fallback, MySQL จริง,
และ mock n8n/Groq:

| การทดสอบ | ผล |
| --- | --- |
| `npm run lint` / `npm run build` | ผ่าน ไม่มี error |
| 15 คำสั่งปกติ (ค้นหา/กรอง/ตะกร้า/เช็กเอาต์) — JSON path | ผ่าน |
| ชุดเดียวกันบน **MySQL 8.4.9 จริง** | ผ่าน `source: "database"` และผลตรงกับ JSON path ทุกรายการ |
| `db/schema.sql` + `db/seed.sql` โหลดลง MySQL | ผ่าน 13 แถว ภาษาไทยและอีโมจิครบ |
| ค้นพิมพ์ผิด `คย์บอร์ด` → `คีย์บอร์ด` | ผ่าน (Dice coefficient) |
| ค้นตามชื่อหมวด `ในหมวดเครื่องใช้ไฟฟ้า` | ผ่าน คืนสินค้าหมวดนั้น 1 รายการ |
| คำนอกโดเมน 4 เคส → `source: "ai"` | ผ่าน (mock n8n + Groq) |
| `จอคอม 4k ราคาไม่เกิน 5000` → CATALOG | ผ่าน AI ได้จอ 27 นิ้ว 4K ราคา 12,900 สต็อก 5 (เดิมตอบ "ไม่พบสินค้า") |
| `อยากทำผัดกะเพรา` → CATALOG ว่าง | ผ่าน AI ตอบว่าไม่มี ไม่ถูกยัดสินค้าไม่เกี่ยวข้องให้อ้าง |
| `transcript` ที่ NLU ทำรูป | ผ่าน โมเดลเห็นประโยคเต็ม "ช่วยแนะนำสูตรอาหารอร่อยๆ" ไม่ใช่ "สูตรอา รอร่อยๆ" |
| Build Prompt + Parse Answer **จากไฟล์ workflow จริง** | ผ่าน mock ที่โหลด jsCode จาก `shopvoice-workflow.json` มารัน ไม่ใช่ prompt จำลอง |
| Groq API จริง | ยังไม่ได้ทดสอบ — ต้องมี API key ของผู้ใช้ใน n8n credential |
| คำสั่ง `add` ที่ไม่พบสินค้า | ไม่หลุดไปหา AI ตามที่ออกแบบไว้ |
| `systemPrompt` ที่ส่งถึง Groq | มาจาก `IT_SHOP_PROFILE` 777 ตัวอักษร ไม่ได้อยู่ใน workflow |
| `n8n import:workflow` บน n8n 2.41.4 | ผ่าน (`Successfully imported 1 workflow`) |
| Webhook ของ n8n รับ payload จริง | ผ่าน ไหลถึง node **Call Groq API** แล้ว |
| `DATABASE_URL` ชี้ port ที่ไม่มีบริการ | ตอบ `source: "json"` ครบ 13 รายการ ไม่ crash |
| `GET /api/voice` | `405` พร้อม header `Allow: POST` |

---

## ข้อจำกัดและแนวทางต่อ

- ยังไม่เชื่อมต่อเกตเวย์หรือระบบชำระเงินจริง
- ไม่มีระบบล็อกอิน/สิทธิ์ผู้ใช้
- การตัดเสียงพึ่ง `SpeechRecognition` ของเบราว์เซอร์ จึงรองรับเฉพาะ Chromium
- ตะกร้าเก็บใน `localStorage` จึงยังไม่ซิงก์ข้ามอุปกรณ์
- ยังไม่ได้ทดสอบกับ Groq API จริง (ต้องมี API key ใน n8n credential)
- ขั้นต่อไป: เพิ่ม intent `เปรียบเทียบสินค้า`, รองรับการสั่งซื้อหลายรายการ
  ในประโยคเดียว, บันทึกประวัติคำสั่งลง MySQL
- เมื่อสินค้าเยอะขึ้นจาก 13 รายการ ควรเปลี่ยนจาก Dice coefficient
  ไปใช้ embedding + vector store เพื่อความแม่นยำที่ดีกว่า
