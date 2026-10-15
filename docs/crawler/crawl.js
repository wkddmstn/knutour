// 각 단과대학 공지사항 페이지를 긁어서 Supabase announcements 테이블에 저장하는 스크립트.
// GitHub Actions가 주기적으로 이 스크립트를 실행해요.
//
// colleges.json의 각 항목에서 url/listSelector/titleSelector/linkSelector가
// 아직 "TODO"인 학과는 건너뛰어요. 실제 사이트 구조를 확인한 뒤 채워 넣으면 돼요.
//
// - listSelector: 공지 목록에서 "글 하나"를 가리키는 CSS 선택자 (예: "table.board-list tbody tr")
// - titleSelector: listSelector로 찾은 요소 안에서 제목 텍스트가 있는 선택자 (예: "td.title a")
// - linkSelector: 제목 링크(href)가 있는 선택자. titleSelector와 같으면 생략 가능

import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요해요. (GitHub Actions secrets에 등록)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const colleges = JSON.parse(fs.readFileSync(path.join(__dirname, "colleges.json"), "utf-8"));

async function crawlCollege(college) {
  if (college.url === "TODO" || college.listSelector === "TODO") {
    console.log(`[건너뜀] ${college.dept}: 아직 설정이 안 됐어요.`);
    return [];
  }

  const res = await fetch(college.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KNUQuestBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  $(college.listSelector).each((_, el) => {
    const $el = $(el);
    const title = $el.find(college.titleSelector).first().text().trim().replace(/\s+/g, " ");
    const linkSel = college.linkSelector || college.titleSelector;
    let link = $el.find(linkSel).first().attr("href") || "";
    if (link && !/^https?:\/\//.test(link)) {
      link = new URL(link, college.url).href;
    }
    if (title) items.push({ title, link });
  });

  // 너무 오래된 공지까지 매번 다시 쓰지 않도록, 최신 20개만
  return items.slice(0, 20);
}

async function main() {
  let okCount = 0;
  let errCount = 0;

  for (const college of colleges) {
    try {
      const items = await crawlCollege(college);
      for (const item of items) {
        const { error } = await supabase.from("announcements").upsert(
          { title: item.title, body: item.link || "", dept: college.dept },
          { onConflict: "title,dept", ignoreDuplicates: true }
        );
        if (error) {
          console.error(`  [오류] ${college.dept} - "${item.title}":`, error.message);
          errCount++;
        } else {
          okCount++;
        }
      }
      if (items.length) console.log(`[완료] ${college.dept}: ${items.length}건 확인`);
    } catch (e) {
      console.error(`[실패] ${college.dept}:`, e.message);
      errCount++;
    }
  }

  console.log(`\n총 처리 ${okCount}건, 오류 ${errCount}건`);
}

main();