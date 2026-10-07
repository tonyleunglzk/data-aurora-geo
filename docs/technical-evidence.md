# GEO 平台技術證據索引

以下連結對應此倉庫內的實際程式，供閱讀及核對。

| 功能 | 前端 | 後端 |
| --- | --- | --- |
| SERP 研究 | [GeoSerpResearchView.vue](../frontend/src/views/geo/GeoSerpResearchView.vue) | [搜尋解析](../backend/src/modules/geo/core/baidu-serp.ts)、[文章分析](../backend/src/modules/geo/core/serp-analysis.ts) |
| AI 總結與規則卡 | [GeoAiSummaryLabView.vue](../frontend/src/views/geo/GeoAiSummaryLabView.vue)、[GeoRuleCardsView.vue](../frontend/src/views/geo/GeoRuleCardsView.vue) | [GEO 服務](../backend/src/modules/geo/geo.service.ts)、[總結提示詞](../backend/src/modules/geo/core/insight-prompts.ts) |
| 提示詞 V2 | [GeoPromptEngineV2View.vue](../frontend/src/views/geo/GeoPromptEngineV2View.vue) | [prompt-v2.ts](../backend/src/modules/geo/core/prompt-v2.ts) |
| 提示詞 V3 | [GeoV3GenerateView.vue](../frontend/src/views/geo-v3/GeoV3GenerateView.vue) | [V3 控制器](../backend/src/modules/geo-v3/geo-v3.controller.ts)、[V3 服務](../backend/src/modules/geo-v3/geo-v3.service.ts) |
| 版本及變量池 | [GeoV3VersionsView.vue](../frontend/src/views/geo-v3/GeoV3VersionsView.vue)、[GeoV3VariablesView.vue](../frontend/src/views/geo-v3/GeoV3VariablesView.vue) | [V3 輸入資料定義](../backend/src/modules/geo-v3/dto/geo-v3.dto.ts) |
| 批次與記錄 | [GeoPromptBatchHistoryView.vue](../frontend/src/views/geo/GeoPromptBatchHistoryView.vue)、[GeoV3RunsView.vue](../frontend/src/views/geo-v3/GeoV3RunsView.vue) | [GEO 控制器](../backend/src/modules/geo/geo.controller.ts)、[V3 服務](../backend/src/modules/geo-v3/geo-v3.service.ts) |
| 發佈回饋 | [GeoPublicationsView.vue](../frontend/src/views/geo/GeoPublicationsView.vue) | [GEO 服務](../backend/src/modules/geo/geo.service.ts) |

## 可核查的技術實作

- **Vue 3 與 TypeScript**：[頁面程式](../frontend/src/views/geo/GeoPromptEngineView.vue)、[業務型別](../frontend/src/types/geo.ts) 和 [API 客戶端](../frontend/src/api/geo.ts) 展示響應式介面、表單資料、流式回應及前後端整合。
- **NestJS**：[應用模組](../backend/src/app.module.ts)、控制器和服務展示模組化 API 及依賴注入。
- **Prisma 與 MySQL**：[schema.prisma](../backend/prisma/schema.prisma) 定義產品、規則、版本、任務、發佈等資料模型；服務程式使用 Prisma 完成資料操作。
- **AI API 整合**：[geo.service.ts](../backend/src/modules/geo/geo.service.ts) 及 [geo-v3.service.ts](../backend/src/modules/geo-v3/geo-v3.service.ts) 含模型客戶端、生成流程和串流處理；倉庫不提供任何 API 密鑰。
- **Python**：[baidu-ai-scraper.py](../backend/src/modules/geo/scripts/baidu-ai-scraper.py) 為搜尋內容抓取輔助程式，與主要 NestJS Web 後端分開。

上述連結證明的是本次快照中可觀察的實作，不以倉庫建立時間代替歷史經歷證明。
