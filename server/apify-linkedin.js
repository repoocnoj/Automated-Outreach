import { ApifyClient } from "apify-client";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

// ═══════════════════════════════════════════════════════════════
// SEARCH LINKEDIN POSTS BY KEYWORD VIA APIFY
// ═══════════════════════════════════════════════════════════════
//
// Uses the "LinkedIn Post Search Scraper" actor on Apify.
// Actor ID: benjarapi/linkedin-post-search
//
// This searches LinkedIn for posts matching your keywords,
// returns post content, author info, and engagement metrics,
// and saves the top results to data/linkedin-posts.json
// for the draft engine to pick up.
// ═══════════════════════════════════════════════════════════════

const ACTOR_ID = "benjarapi/linkedin-post-search";

// How many posts to pull per keyword search
const POSTS_PER_KEYWORD = 5;

// Total max posts to keep (top by engagement)
const MAX_TOTAL_POSTS = 10;

export async function fetchLinkedInPosts() {
  const keywordsRaw = process.env.LINKEDIN_SEARCH_KEYWORDS || "";
  const keywords = keywordsRaw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    console.warn("⚠️  No LINKEDIN_SEARCH_KEYWORDS set in .env. Skipping.");
    return [];
  }

  if (!process.env.APIFY_API_TOKEN) {
    console.warn("⚠️  No APIFY_API_TOKEN set in .env. Skipping LinkedIn post search.");
    return [];
  }

  console.log(`\n🔍 Searching LinkedIn for ${keywords.length} keyword groups via Apify...`);

  const allPosts = [];

  for (const keyword of keywords) {
    console.log(`   Searching: "${keyword}"...`);

    try {
      // Build the LinkedIn search URL for this keyword
      const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&sortBy=%22date_posted%22`;

      const run = await apify.actor(ACTOR_ID).call({
        searchUrls: [searchUrl],
        maxPosts: POSTS_PER_KEYWORD,
        scrapeComments: false,
        scrapeReactions: false,
      });

      // Wait for results
      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      for (const item of items) {
        allPosts.push({
          author: item.authorName || item.author?.name || "Unknown",
          authorTitle: item.authorHeadline || item.author?.headline || "",
          content: item.text || item.content || "",
          url: item.url || item.postUrl || item.linkedinUrl || "",
          likes: item.numLikes || item.reactions || item.socialCounts?.numLikes || 0,
          comments: item.numComments || item.socialCounts?.numComments || 0,
          shares: item.numShares || item.socialCounts?.numShares || 0,
          date: item.postedDate || item.publishedAt || new Date().toISOString().split("T")[0],
          keyword: keyword,
        });
      }

      console.log(`   ✓ Found ${items.length} posts for "${keyword}"`);

      // Small delay between searches to be respectful
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`   ✗ Search failed for "${keyword}": ${err.message}`);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (!p.url || seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  // Sort by engagement (likes + comments) and take top N
  const ranked = unique
    .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
    .slice(0, MAX_TOTAL_POSTS);

  // Save to file
  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data", { recursive: true });
  }

  fs.writeFileSync("./data/linkedin-posts.json", JSON.stringify(ranked, null, 2));

  console.log(`\n   ✅ Saved top ${ranked.length} LinkedIn posts to data/linkedin-posts.json`);
  console.log(`      Top post: "${ranked[0]?.author}" — ${ranked[0]?.likes} likes\n`);

  return ranked;
}

// ═══════════════════════════════════════════════════════════════
// RUN STANDALONE (for testing)
// ═══════════════════════════════════════════════════════════════

if (process.argv[1]?.includes("apify-linkedin")) {
  fetchLinkedInPosts()
    .then((posts) => {
      console.log(`Done. ${posts.length} posts saved.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}
