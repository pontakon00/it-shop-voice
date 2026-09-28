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
 source: "mysql" | "json"                    ┌──────────────────┐
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
  "query": "ทำผัดกะเพรา",
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
| **Webhook** | รับ `{ query, profile }` |
| **Build Prompt** | ประกอบ `system` + `user` message จาก `profile` (ไม่ hardcode โดเมน) |
| **Call Groq API** | `llama-3.3-70b-versatile`, `temperature 0.3`, `response_format: json_object` |
| **Parse Answer** | แกะ JSON → `{ answer, suggestions }` |
| **Respond to Webhook** | คืน `{ answer, suggestions, model }` |

เว็บรับคำตอบมาแสดงเป็นการ์ด AI พร้อมป้ายบอกแหล่งที่มา (`source: "ai"`)
และมี timeout (ค่าเริ่มต้น 8 วินาที, ปรับด้วย `N8N_TIMEOUT_MS`) ถ้า n8n ล่ม
ระบบจะถือว่าไม่มี AI แล้วตอบแบบเดิม ไม่ทำให้หน้าเว็บพัง

> คำสั่งที่เป็น `add` / `remove` / `checkout` **จะไม่ถูกส่งให้ AI**
> เพราะ AI ไม่ควรตีความความหมายของตะกร้า — ให้ระบบถามกลับผู้ใช้แทน

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
  "source": "ai",                    // ← ไม่ใช่ mysql/json
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
- **MySQL 8** ผ่าน `mysql2` (Docker Compose) + JSON fallback
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

### เปิด MySQL

```bash
docker compose up -d
```

`docker-compose.yml` จะสร้าง MySQL 8.4 พร้อม mount `db/schema.sql` และ `db/seed.sql`
เข้า `products` 13 รายการอัตโนมัติ จากนั้นสร้าง `.env.local`:

```bash
cp .env.example .env.local
```

### เปิด n8n + Groq

```bash
npm install -g n8n
n8n
```

1. เปิด [http://localhost:5678](http://localhost:5678)
2. **Workflows → Import from File** เลือก `n8n/shopvoice-workflow.json`
3. ใส่คีย์ Groq: ไปที่ **Credentials → New → OpenAI** → ใช้ base URL
   `https://api.groq.com/openai/v1` และ API key จาก [console.groq.com/keys](https://console.groq.com/keys)
   (หรือตั้งเป็น env ของ n8n ด้วย `GROQ_API_KEY` ใน `%USERPROFILE%\.n8n\.env`
   และ `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`)
4. กด **Activate** แล้วเอา URL ที่ขึ้นมาใส่ `N8N_WEBHOOK_URL` ใน `.env.local`
5. `npm run dev` ใหม่

### ตรวจว่าทุกชั้นทำงาน

```bash
curl http://localhost:3000/api/products   # ดูว่า source เป็น "mysql" แล้วหรือยัง
```

`source` จะบอกว่าตอนนั้นระบบดึงข้อมูลจากไหน: `mysql` (MySQL), `json` (fallback),
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
│   ├── SourceBadge.tsx         # ป้ายบอกแหล่งที่มา (mysql / json / ai)
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
  "source": "mysql",            // หรือ "json"
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

คืน `source` (`mysql` | `json`), `total` และ `products` ทั้งหมด
ใช้ตรวจว่าเชื่อมต่อฐานข้อมูลสำเร็จหรือยัง

### กฎการทำงาน

- ข้อความว่าง → `200` พร้อมข้อความแนะนำ (ไม่ error เพื่อให้ UI เรียกได้ตลอด)
- ข้อความยาวเกิน 200 ตัวอักษร → ตัดและแนะนำให้พูดสั้นลง
- หน้า `/api/voice` ทำงานแบบ stateless — ตะกร้าอยู่ฝั่ง client

---

## ผลการตรวจสอบ

รันจริงด้วย `next start` และ mock n8n/Groq เพื่อพิสูจน์พฤติกรรมแต่ละชั้น:

| การทดสอบ | ผล |
| --- | --- |
| `npm run lint` / `npm run build` | ผ่าน ไม่มี error |
| 15 คำสั่งปกติ (ค้นหา/กรอง/ตะกร้า/เช็กเอาต์) | ผ่าน ผลตรงกับเวอร์ชันก่อนเพิ่ม MySQL |
| ค้นพิมพ์ผิด `คย์บอร์ด` → `คีย์บอร์ด` | ผ่าน (Dice coefficient) |
| คำนอกโดเมน 4 เคส → `source: "ai"` | ผ่าน |
| คำสั่ง `add` ที่ไม่พบสินค้า | ไม่หลุดไปหา AI ตามที่ออกแบบไว้ |
| `DATABASE_URL` ชี้ port ที่ไม่มีบริการ | ตอบ `source: "json"` ครบ 13 รายการ ไม่ crash |
| `GET /api/voice` | `405` พร้อม header `Allow: POST` |

---

## ข้อจำกัดและแนวทางต่อ

- ยังไม่เชื่อมต่อเกตเวย์หรือระบบชำระเงินจริง
- ไม่มีระบบล็อกอิน/สิทธิ์ผู้ใช้
- การตัดเสียงพึ่ง `SpeechRecognition` ของเบราว์เซอร์ จึงรองรับเฉพาะ Chromium
- ตะกร้าเก็บใน `localStorage` จึงยังไม่ซิงก์ข้ามอุปกรณ์
- ขั้นต่อไป: เพิ่ม intent `เปรียบเทียบสินค้า`, รองรับการสั่งซื้อหลายรายการ
  ในประโยคเดียว, เพิ่ม RAG บน catalog และประวัติคำสั่งลง MySQL
