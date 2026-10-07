<template>
  <section class="geo-v3-page">
    <article class="surface-card section-card geo-v3-toolbar reveal-up">
      <div>
        <h3>V3 版本规则</h3>
        <p>版本只维护一整段文章规则；变量池绑定在版本下，AI 建版后可自动带出变量草稿。</p>
      </div>
      <div class="geo-v3-actions">
        <el-button :loading="loading" plain @click="loadVersions">刷新</el-button>
        <el-button plain @click="openChatDialog">AI 对话创建</el-button>
        <el-button plain @click="openBatchTxtDialog">TXT/MD 批量建版</el-button>
        <el-button plain @click="draftDialogVisible = true">文章生成草稿</el-button>
        <el-button type="primary" @click="resetForm">新建版本</el-button>
      </div>
    </article>

    <article class="surface-card section-card geo-v3-fixed-rules reveal-up" style="--delay: 0.04s">
      <div class="geo-v3-form-head">
        <div>
          <h3>V3 系统级固定规则</h3>
          <p>生成 Prompt 时会自动叠加这组规则；适合维护图片占位、编号、SEO/GEO 等长期稳定约束。</p>
        </div>
        <div class="geo-v3-actions">
          <el-tag effect="light" round>{{ fixedRulesUpdatedAt ? `更新于 ${formatDate(fixedRulesUpdatedAt)}` : '未加载' }}</el-tag>
          <el-button :loading="fixedRulesLoading" plain @click="loadFixedRules">刷新</el-button>
          <el-button :loading="fixedRulesSaving" type="primary" @click="saveFixedRules">保存固定规则</el-button>
        </div>
      </div>
      <el-input
        v-model="fixedRulesText"
        :rows="8"
        placeholder="在这里维护 V3 系统级固定规则"
        resize="vertical"
        type="textarea"
      />
    </article>

    <section class="geo-v3-workbench">
      <article v-loading="loading" class="surface-card section-card geo-v3-list reveal-up" style="--delay: 0.08s">
        <div v-if="versions.length === 0 && !loading" class="geo-v3-empty">
          <strong>暂无 V3 版本</strong>
          <span>先在右侧创建一套文章规则。</span>
        </div>

        <div v-else class="geo-v3-list-tree-wrap">
          <div class="geo-v3-list-toolbar">
            <div>
              <strong>版本列表</strong>
              <span>{{ versions.length }} 个版本</span>
            </div>
            <div class="geo-v3-actions">
              <el-button link type="primary" @click="expandAllVersionFolders">全部展开</el-button>
              <el-button link type="primary" @click="collapseAllVersionFolders">全部折叠</el-button>
            </div>
          </div>

          <div class="geo-v3-list-batch">
            <el-checkbox
              :indeterminate="versionSelectionIndeterminate"
              :model-value="allVersionsSelected"
              @change="toggleAllVersions"
            >
              全选
            </el-checkbox>
            <span>已选 {{ selectedVersionIds.length }} 项</span>
            <div class="geo-v3-list-batch__actions">
              <el-button
                :disabled="selectedVersionIds.length === 0"
                :loading="batchVersionUpdating"
                plain
                size="small"
                @click="batchPauseVersions"
              >
                批量暂停
              </el-button>
              <el-button
                :disabled="selectedVersionIds.length === 0"
                :loading="batchVersionUpdating"
                plain
                size="small"
                type="danger"
                @click="batchArchiveVersions"
              >
                批量归档
              </el-button>
            </div>
          </div>

          <div class="geo-v3-folder-tree">
            <section v-for="category in groupedVersions" :key="category.key" class="geo-v3-folder">
              <button
                :class="['geo-v3-folder__head', 'geo-v3-folder-toggle', { collapsed: isVersionCategoryCollapsed(category.key) }]"
                type="button"
                @click="toggleVersionCategory(category.key)"
              >
                <span class="geo-v3-folder-toggle__label">
                  <el-icon><ArrowRight /></el-icon>
                  <strong>{{ category.category }}</strong>
                </span>
                <el-tag effect="light" round size="small">{{ category.count }} 个版本</el-tag>
              </button>

              <template v-if="!isVersionCategoryCollapsed(category.key)">
                <section v-for="group in category.groups" :key="group.key" class="geo-v3-folder__branch">
                  <button
                    :class="['geo-v3-folder__branch-head', 'geo-v3-folder-toggle', { collapsed: isVersionGroupCollapsed(group.key) }]"
                    type="button"
                    @click="toggleVersionGroup(group.key)"
                  >
                    <span class="geo-v3-folder-toggle__label">
                      <el-icon><ArrowRight /></el-icon>
                      <span>{{ group.platform }}</span>
                    </span>
                    <em>{{ group.items.length }}</em>
                  </button>

                  <template v-if="!isVersionGroupCollapsed(group.key)">
                    <div
                      v-for="{ item, displayName } in group.items"
                      :key="item.id"
                      :class="['geo-v3-list-item', { active: form.id === item.id }]"
                    >
                      <div class="geo-v3-list-item__check">
                        <el-checkbox
                          :aria-label="`选择版本 ${item.name}`"
                          :model-value="isVersionSelected(item.id)"
                          @change="toggleVersionSelection(item.id, $event)"
                        />
                      </div>
                      <button class="geo-v3-list-item__content" type="button" @click="selectVersion(item)">
                        <div class="geo-v3-list-item__top">
                          <strong>{{ displayName }}</strong>
                          <el-tag :type="item.isActive ? 'success' : 'info'" effect="light" round size="small">
                            {{ item.isActive ? '启用' : '停用' }}
                          </el-tag>
                        </div>
                        <p>{{ item.description || item.name }}</p>
                        <span>
                          {{ item.sourceArticleUrl ? '有默认 URL' : '无默认 URL' }} ·
                          {{ item.sourceArticleText ? '有默认正文' : '无默认正文' }} ·
                          {{ formatDate(item.updatedAt) }}
                        </span>
                      </button>
                    </div>
                  </template>
                </section>
              </template>
            </section>
          </div>
        </div>
      </article>

      <article class="surface-card section-card reveal-up" style="--delay: 0.12s">
        <div class="geo-v3-form-head">
          <div>
            <h3>{{ form.id ? '编辑版本' : '新建版本' }}</h3>
            <p>正式保存时会同时保存版本规则和下方绑定变量池。</p>
          </div>
          <div class="geo-v3-actions">
            <el-button :disabled="!form.id" plain type="danger" @click="removeVersion">归档</el-button>
            <el-button :loading="saving" type="primary" @click="saveVersion">保存</el-button>
          </div>
        </div>

        <el-form label-position="top">
          <div class="geo-v3-form-grid">
            <el-form-item label="版本名称">
              <el-input v-model="form.name" placeholder="如：测评榜单结构版" />
            </el-form-item>
            <el-form-item label="启用状态">
              <el-switch v-model="form.isActive" />
            </el-form-item>
          </div>

          <div class="geo-v3-form-grid">
            <el-form-item label="竞对文章标题">
              <el-input v-model="form.sourceArticleTitle" placeholder="可选，用于追溯来源" />
            </el-form-item>
          </div>

          <el-form-item label="竞对文章 URL">
            <el-input v-model="form.sourceArticleUrl" clearable placeholder="https://..." />
          </el-form-item>

          <el-form-item label="竞对文章正文">
            <el-input
              v-model="form.sourceArticleText"
              :autosize="{ minRows: 5, maxRows: 12 }"
              placeholder="可选。生成页选择“粘贴正文”时，切换到该版本会自动填入这段正文"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>

          <el-form-item label="版本说明">
            <el-input v-model="form.description" :rows="2" resize="vertical" type="textarea" />
          </el-form-item>

          <el-form-item label="版本规则内容">
            <el-input
              v-model="form.ruleText"
              :rows="18"
              placeholder="把文章结构、写法、标题规则、段落规则、SEO/GEO 布局、禁用项写成一整段规则。这里不放变量候选池和产品卖点。"
              resize="vertical"
              type="textarea"
            />
          </el-form-item>

          <el-form-item label="备注">
            <el-input v-model="form.notes" :rows="3" resize="vertical" type="textarea" />
          </el-form-item>
        </el-form>

        <div class="geo-v3-section-head">
          <div>
            <h4>绑定变量池</h4>
            <p>AI 建版会先生成候选变量草稿；用户再决定抽取方式和抽取数量。</p>
          </div>
          <div class="geo-v3-actions">
            <el-button :disabled="!variableForm.id" plain type="danger" @click="removeVariableSet">
              删除变量池
            </el-button>
            <el-button :loading="variableStructuring" plain @click="restructureVariableSet">
              重新整理变量池
            </el-button>
            <el-button plain @click="addVariableItem">新增变量</el-button>
          </div>
        </div>

        <el-form label-position="top">
          <div class="geo-v3-form-grid">
            <el-form-item label="变量池名称">
              <el-input v-model="variableForm.name" placeholder="如：测评榜单差异化变量" />
            </el-form-item>
          </div>

          <div class="geo-v3-form-grid">
            <el-form-item label="变量池说明">
              <el-input v-model="variableForm.description" placeholder="这组变量适合当前版本的哪些内容变化" />
            </el-form-item>
            <el-form-item label="启用状态">
              <el-switch v-model="variableForm.isActive" />
            </el-form-item>
          </div>
        </el-form>

        <div v-if="variableForm.items.length === 0" class="geo-v3-empty geo-v3-empty--inline">
          <strong>当前版本还没有变量</strong>
          <span>如果这个版本需要多篇差异化内容，点击“新增变量”配置候选池。</span>
        </div>

        <div v-else class="geo-v3-variable-items">
          <article
            v-for="(item, index) in variableForm.items"
            :key="item.localKey"
            class="geo-v3-variable-card"
          >
            <div class="geo-v3-variable-card__head">
              <strong>变量 {{ index + 1 }}</strong>
              <div class="geo-v3-actions">
                <el-switch v-model="item.isActive" active-text="启用" inactive-text="停用" inline-prompt />
                <el-button plain type="danger" @click="removeVariableItem(index)">移除</el-button>
              </div>
            </div>

            <div class="geo-v3-variable-grid">
              <el-form-item label="字段名">
                <el-input v-model="item.name" placeholder="如：opening_angle" />
              </el-form-item>
              <el-form-item label="显示名称">
                <el-input v-model="item.label" placeholder="如：开头角度" />
              </el-form-item>
              <el-form-item label="抽取方式">
                <el-select v-model="item.pickMode" style="width: 100%" @change="handlePickModeChange(item)">
                  <el-option label="随机 1 个" value="ONE" />
                  <el-option label="随机 X 个" value="MANY" />
                </el-select>
              </el-form-item>
            </div>

            <div class="geo-v3-variable-grid geo-v3-variable-grid--range">
              <el-form-item label="抽取数量">
                <div :class="['geo-count-stepper', { disabled: item.pickMode === 'ONE' }]">
                  <button
                    :disabled="item.pickMode === 'ONE' || getPickCount(item) <= 1"
                    aria-label="减少抽取数量"
                    title="减少"
                    type="button"
                    @click="stepPickCount(item, -1)"
                  >
                    -
                  </button>
                  <input
                    :disabled="item.pickMode === 'ONE'"
                    :value="getPickCount(item)"
                    min="1"
                    type="number"
                    @blur="normalizePickCount(item)"
                    @input="updatePickCountFromEvent(item, $event)"
                  />
                  <button
                    :disabled="item.pickMode === 'ONE'"
                    aria-label="增加抽取数量"
                    title="增加"
                    type="button"
                    @click="stepPickCount(item, 1)"
                  >
                    +
                  </button>
                </div>
              </el-form-item>
              <el-form-item label="说明">
                <el-input v-model="item.description" placeholder="可选，只用于后台管理" />
              </el-form-item>
            </div>

            <el-form-item label="候选值">
              <el-input
                v-model="item.candidatesText"
                :rows="5"
                placeholder="每行一条候选值"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
          </article>
        </div>
      </article>
    </section>

    <el-dialog v-model="draftDialogVisible" title="用竞对文章生成 V3 草稿" width="760px">
      <el-form label-position="top">
        <el-form-item label="文章 URL">
          <el-input v-model="draftForm.articleUrl" placeholder="可填 URL，系统会尝试抓取正文" />
        </el-form-item>
        <el-form-item label="文章正文">
          <el-input
            v-model="draftForm.articleText"
            :rows="10"
            placeholder="也可以直接粘贴竞对文章正文"
            resize="vertical"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="补充要求">
          <el-input v-model="draftForm.notes" :rows="3" resize="vertical" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="draftDialogVisible = false">取消</el-button>
        <el-button :loading="drafting" type="primary" @click="createDraft">生成草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="batchTxtDialogVisible"
      :close-on-click-modal="!batchTxtSubmitting && !batchTxtRetrying"
      class="geo-v3-batch-dialog"
      title="TXT/MD 批量建版"
      width="1040px"
    >
      <div class="geo-v3-batch-layout">
        <section class="geo-v3-batch-panel">
          <div class="geo-v3-section-head geo-v3-section-head--compact">
            <div>
              <h4>上传 TXT / MD</h4>
              <p>文件名会作为 V3 版本名称，正文会作为竞对文章材料。</p>
            </div>
            <div class="geo-v3-actions">
              <input
                ref="batchTxtFileInputRef"
                accept=".txt,.md,text/plain,text/markdown,text/x-markdown"
                class="geo-v3-hidden-file"
                multiple
                type="file"
                @change="handleBatchTxtFileInput"
              />
              <el-button plain @click="chooseBatchTxtFiles">选择文件</el-button>
              <el-button :disabled="batchTxtFiles.length === 0 || batchTxtSubmitting" plain @click="clearBatchTxtFiles">
                清空
              </el-button>
            </div>
          </div>

          <div v-if="batchTxtFiles.length === 0" class="geo-v3-empty geo-v3-empty--inline">
            <strong>还没有 TXT / MD 文件</strong>
            <span>一次最多 20 个文件，支持 .txt 和 .md，单篇正文不超过 120,000 字符。</span>
          </div>

          <div v-else class="geo-v3-batch-file-list">
            <article v-for="file in batchTxtFiles" :key="file.localKey">
              <div>
                <strong>{{ toBatchTxtVersionName(file.fileName) }}</strong>
                <p>{{ file.fileName }} · {{ file.content.length.toLocaleString('zh-CN') }} 字符</p>
              </div>
              <el-button :disabled="batchTxtSubmitting" plain type="danger" @click="removeBatchTxtFile(file.localKey)">
                移除
              </el-button>
            </article>
          </div>

          <el-form class="geo-v3-batch-form" label-position="top">
            <div class="geo-v3-form-grid">
              <el-form-item required label="产品品类">
                <el-input
                  v-model="batchTxtForm.productCategory"
                  :disabled="batchTxtSubmitting"
                  maxlength="40"
                  placeholder="必填，如：防晒衣 / 学习机"
                  show-word-limit
                />
                <p class="geo-v3-field-tip">
                  用来告诉 AI 本次建版的产品方向；不填容易导致规则、变量池和品牌推荐跑偏。
                </p>
              </el-form-item>
              <el-form-item label="模型">
                <el-input v-model="batchTxtForm.model" placeholder="默认 claude-opus-4-8" />
              </el-form-item>
            </div>
          </el-form>
        </section>

        <section class="geo-v3-batch-panel">
          <div class="geo-v3-section-head geo-v3-section-head--compact">
            <div>
              <h4>建版要求模板</h4>
              <p>每次任务都会保存这份模板，也会写入 AI 对话记录。</p>
            </div>
            <div class="geo-v3-actions">
              <el-button :disabled="batchTxtSubmitting || !batchTxtRequirementsText.trim()" plain @click="clearBatchTxtRequirements">
                清空内容
              </el-button>
            </div>
          </div>

          <el-input
            v-model="batchTxtRequirementsText"
            :rows="18"
            class="geo-v3-batch-requirements-textarea"
            maxlength="12000"
            placeholder="请自行输入本次批量建版要求。可以写成 #1、#2，也可以直接写成完整说明。"
            resize="vertical"
            show-word-limit
            type="textarea"
          />
        </section>
      </div>

      <section v-if="currentBatchTxtJob" class="geo-v3-batch-result">
        <div class="geo-v3-section-head geo-v3-section-head--compact">
          <div>
            <h4>任务 #{{ currentBatchTxtJob.id }}</h4>
            <p>
              {{ getBatchTxtJobStatusLabel(currentBatchTxtJob.status) }} ·
              成功 {{ currentBatchTxtJob.successCount }} ·
              跳过 {{ currentBatchTxtJob.skippedCount }} ·
              失败 {{ currentBatchTxtJob.failedCount }} ·
              总数 {{ currentBatchTxtJob.requestedCount }}
            </p>
          </div>
          <el-tag :type="getBatchTxtJobStatusTagType(currentBatchTxtJob.status)" effect="light" round>
            {{ getBatchTxtJobStatusLabel(currentBatchTxtJob.status) }}
          </el-tag>
        </div>
        <el-progress :percentage="currentBatchTxtJob.progress" :stroke-width="10" />
        <div class="geo-v3-batch-result-list">
          <article v-for="item in currentBatchTxtJob.items || []" :key="item.id">
            <el-tag :type="getBatchTxtItemStatusTagType(item.status)" effect="light" round size="small">
              {{ getBatchTxtItemStatusLabel(item.status) }}
            </el-tag>
            <div>
              <strong>{{ item.versionName }}</strong>
              <p>{{ item.errorMessage || item.fileName }}</p>
            </div>
            <div class="geo-v3-actions">
              <el-button
                :disabled="!item.versionId"
                plain
                size="small"
                @click="openBatchTxtVersion(item)"
              >
                查看版本
              </el-button>
              <el-button
                :disabled="!item.draftSessionId"
                plain
                size="small"
                @click="openBatchTxtSession(item)"
              >
                看对话
              </el-button>
            </div>
          </article>
        </div>
      </section>

      <template #footer>
        <el-button @click="batchTxtDialogVisible = false">关闭</el-button>
        <el-button :loading="batchTxtRefreshing" :disabled="!currentBatchTxtJob" plain @click="refreshCurrentBatchTxtJob">
          刷新任务
        </el-button>
        <el-button
          v-if="currentBatchTxtJob?.failedCount"
          :disabled="!isBatchTxtTerminal(currentBatchTxtJob.status)"
          :loading="batchTxtRetrying"
          plain
          type="warning"
          @click="retryCurrentBatchTxtFailedItems"
        >
          重试失败项（{{ currentBatchTxtJob.failedCount }}）
        </el-button>
        <el-button :loading="batchTxtSubmitting" type="primary" @click="submitBatchTxtJob">
          开始批量建版
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="chatDialogVisible" class="geo-v3-chat-dialog" title="AI 对话创建 V3 版本" width="1180px">
      <section class="geo-v3-chat-layout">
        <aside class="geo-v3-chat-sessions">
          <div class="geo-v3-chat-title">
            <h4>会话记录</h4>
            <p>V3 会话独立保存，也可以按需导入 V2 会话。</p>
          </div>
          <div class="geo-v3-chat-session-actions">
            <el-button :loading="chatSessionsLoading" plain size="small" @click="loadChatSessions">刷新</el-button>
            <el-button plain size="small" @click="createChatSession">新建</el-button>
            <el-button plain size="small" @click="openV2ImportDialog">导入 V2</el-button>
          </div>

          <div v-loading="chatSessionsLoading" class="geo-v3-chat-session-list">
            <div v-if="chatSessions.length === 0 && !chatSessionsLoading" class="geo-v3-empty geo-v3-empty--inline">
              <strong>暂无会话</strong>
              <span>新建后会按标题自动归档。</span>
            </div>

            <div v-else class="geo-v3-folder-tree geo-v3-folder-tree--compact">
              <section v-for="category in groupedChatSessions" :key="category.key" class="geo-v3-folder">
                <div class="geo-v3-folder__head">
                  <strong>{{ category.category }}</strong>
                  <el-tag effect="light" round size="small">{{ category.count }}</el-tag>
                </div>

                <section v-for="group in category.groups" :key="group.key" class="geo-v3-folder__branch">
                  <div class="geo-v3-folder__branch-head">
                    <span>{{ group.platform }}</span>
                    <em>{{ group.items.length }}</em>
                  </div>

                  <button
                    v-for="{ item: session, displayName } in group.items"
                    :key="session.id"
                    :class="['geo-v3-chat-session', { active: activeChatSessionId === session.id }]"
                    type="button"
                    @click="selectChatSession(session)"
                  >
                    <strong>{{ displayName }}</strong>
                    <span>{{ session.lastMessagePreview || session.suggestedName || session.title || '暂无对话内容' }}</span>
                    <div class="geo-v3-chat-session__foot">
                      <el-tag :type="getDraftSessionSourceTagType(session.sourceType)" effect="light" round size="small">
                        {{ getDraftSessionSourceLabel(session.sourceType) }}
                      </el-tag>
                      <em>{{ session.status === 'APPLIED' ? '已应用' : '草稿' }} · {{ formatDate(session.updatedAt) }}</em>
                    </div>
                  </button>
                </section>
              </section>
            </div>
          </div>
        </aside>

        <aside class="geo-v3-chat-context">
          <div class="geo-v3-chat-title">
            <h4>参考材料</h4>
            <p>保存后刷新页面仍可继续同一轮对话。</p>
          </div>

          <el-form label-position="top">
            <el-form-item label="会话标题">
              <el-input v-model="chatForm.title" placeholder="如：测评榜单 AI 建版" />
            </el-form-item>
            <el-form-item label="模型">
              <el-input v-model="chatForm.model" placeholder="默认 claude-opus-4-8" />
            </el-form-item>
            <el-form-item label="输入方式">
              <el-radio-group v-model="chatInputMode">
                <el-radio-button label="text">粘贴正文</el-radio-button>
                <el-radio-button label="url">输入 URL</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item v-if="chatInputMode === 'url'" label="文章 URL">
              <el-input v-model="chatForm.articleUrl" clearable placeholder="https://..." />
            </el-form-item>

            <el-form-item v-else label="文章正文">
              <el-input
                v-model="chatForm.articleText"
                :rows="9"
                placeholder="把竞对文章正文粘贴到这里"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>

            <el-form-item label="补充要求">
              <el-input
                v-model="chatForm.notes"
                :rows="4"
                placeholder="比如：更偏测评榜单、保留三级品牌权重、变量另放变量池"
                resize="vertical"
                type="textarea"
              />
            </el-form-item>
          </el-form>

          <div class="geo-v3-chat-context-actions">
            <el-button
              :disabled="!activeChatSessionId"
              :loading="chatSaving"
              plain
              @click="saveActiveChatSession"
            >
              保存会话
            </el-button>
            <el-button :disabled="!activeChatSessionId" plain type="danger" @click="deleteActiveChatSession">
              删除会话
            </el-button>
          </div>
        </aside>

        <article class="geo-v3-chat-panel">
          <div class="geo-v3-chat-title">
            <h4>对话建版</h4>
            <p>应用结果会填入版本规则内容，并把变量池草稿放到编辑区下方。</p>
          </div>

          <div ref="chatMessagesRef" class="geo-v3-chat-messages">
            <div v-if="chatMessages.length === 0" class="geo-v3-empty geo-v3-empty--inline">
              <strong>还没有对话</strong>
              <span>可以先问：“请分析这篇竞对文章，整理成 V3 结构规则和变量池草稿”。</span>
            </div>

            <div
              v-for="(message, index) in chatMessages"
              :key="`${message.createdAt}-${index}`"
              :class="['geo-v3-chat-message', `geo-v3-chat-message--${message.role}`]"
            >
              <strong>{{ message.role === 'user' ? '你' : 'AI' }}</strong>
              <p>{{ message.content || (chatStreaming && index === chatMessages.length - 1 ? '正在整理...' : '') }}</p>
            </div>
          </div>

          <div class="geo-v3-chat-composer">
            <el-input
              v-model="chatInput"
              :autosize="{ minRows: 3, maxRows: 6 }"
              :disabled="chatStreaming"
              placeholder="输入你想让 AI 分析或调整的规则方向"
              resize="none"
              type="textarea"
            />
            <div class="geo-v3-chat-actions">
              <el-button :disabled="chatStreaming || chatMessages.length === 0" plain @click="clearChatMessages">
                清空对话
              </el-button>
              <el-button :loading="chatApplying" :disabled="chatStreaming || !activeChatSessionId" plain @click="applyChatDraft">
                应用到编辑区
              </el-button>
              <el-button :loading="chatStreaming" type="primary" @click="sendChatMessage">发送</el-button>
            </div>
          </div>
        </article>
      </section>
    </el-dialog>

    <el-dialog
      v-model="applyProgressDialogVisible"
      :close-on-click-modal="false"
      :show-close="false"
      title="正在整理 AI 对话结果"
      width="620px"
    >
      <div class="geo-v3-apply-progress">
        <el-progress :percentage="applyProgressPercent" :stroke-width="10" />
        <el-steps :active="applyProgressActive" finish-status="success" simple>
          <el-step v-for="step in applyProgressSteps" :key="step" :title="step" />
        </el-steps>
        <p>{{ applyProgressText }}</p>
      </div>
    </el-dialog>

    <el-dialog
      v-model="applyPreviewDialogVisible"
      :close-on-click-modal="false"
      title="确认应用到编辑区"
      width="1080px"
    >
      <div v-if="pendingApplyDraft" class="geo-v3-apply-review">
        <el-alert
          v-if="hasBlockingApplyIssues"
          title="当前整理结果还不适合直接应用"
          description="请查看校验项，补充反馈后点击“重新整理”。系统不会把不合格内容写入版本规则。"
          show-icon
          type="warning"
        />
        <el-alert
          v-else
          title="整理结果通过基础校验"
          description="请人工确认版本规则是否符合预期，再应用到编辑区。"
          show-icon
          type="success"
        />

        <section class="geo-v3-apply-review__checks">
          <article v-for="item in applyValidationItems" :key="item.label">
            <el-tag :type="item.passed ? 'success' : item.level === 'danger' ? 'danger' : 'warning'">
              {{ item.passed ? '通过' : item.blocking ? '需修正' : '提示' }}
            </el-tag>
            <div>
              <strong>{{ item.label }}</strong>
              <p>{{ item.message }}</p>
            </div>
          </article>
        </section>

        <section class="geo-v3-apply-review__content">
          <article>
            <div class="geo-v3-section-head geo-v3-section-head--compact">
              <div>
                <h3>版本规则内容预览</h3>
                <p>确认这段内容是正式规则，而不是聊天总结、变量池或使用说明。</p>
              </div>
              <el-tag>{{ pendingApplyDraft.ruleText.length }} 字</el-tag>
            </div>
            <el-input
              :model-value="pendingApplyDraft.ruleText"
              :rows="18"
              readonly
              resize="vertical"
              type="textarea"
            />
          </article>

          <article>
            <div class="geo-v3-section-head geo-v3-section-head--compact">
              <div>
                <h3>变量池预览</h3>
                <p>变量池只作为草稿进入下方变量区，不会混入版本规则。</p>
              </div>
              <el-tag>{{ pendingApplyDraft.variableSetDraft.items.length }} 个变量</el-tag>
            </div>
            <div v-if="pendingApplyDraft.variableSetDraft.items.length" class="geo-v3-apply-variable-list">
              <div v-for="item in pendingApplyDraft.variableSetDraft.items" :key="item.name">
                <strong>{{ item.label }}</strong>
                <span>{{ item.candidates.slice(0, 4).join('、') }}</span>
              </div>
            </div>
            <div v-else class="geo-v3-empty geo-v3-empty--inline">
              <strong>暂未识别到变量</strong>
              <span>可以确认应用后手动补充，或填写反馈后重新整理。</span>
            </div>

            <el-form label-position="top" class="geo-v3-apply-feedback">
              <el-form-item label="如果不合理，告诉 AI 怎么改">
                <el-input
                  v-model="applyReviewFeedback"
                  :rows="4"
                  placeholder="例如：不要输出聊天总结，只保留正式 ruleText；变量池不要写进版本规则；沿用上一轮完整规则，只更新变量池。"
                  resize="vertical"
                  type="textarea"
                />
              </el-form-item>
            </el-form>
          </article>
        </section>
      </div>

      <template #footer>
        <el-button @click="cancelApplyReview">取消</el-button>
        <el-button :loading="chatApplying" plain @click="rebuildApplyDraft">
          重新整理
        </el-button>
        <el-button :disabled="hasBlockingApplyIssues" type="primary" @click="confirmApplyDraft">
          确认应用
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="v2ImportDialogVisible" title="导入 V2 AI 对话" width="760px">
      <div v-loading="v2SessionsLoading" class="geo-v3-v2-import-list">
        <div v-if="v2Sessions.length === 0 && !v2SessionsLoading" class="geo-v3-empty geo-v3-empty--inline">
          <strong>没有可导入的 V2 会话</strong>
          <span>V2 页面产生的 AI 对话会在这里按需复制到 V3。</span>
        </div>

        <div v-else class="geo-v3-folder-tree">
          <section v-for="category in groupedV2Sessions" :key="category.key" class="geo-v3-folder">
            <div class="geo-v3-folder__head">
              <strong>{{ category.category }}</strong>
              <el-tag effect="light" round size="small">{{ category.count }} 个会话</el-tag>
            </div>

            <section v-for="group in category.groups" :key="group.key" class="geo-v3-folder__branch">
              <div class="geo-v3-folder__branch-head">
                <span>{{ group.platform }}</span>
                <em>{{ group.items.length }}</em>
              </div>

              <article
                v-for="{ item: session, displayName } in group.items"
                :key="session.id"
                class="geo-v3-v2-import-item"
              >
                <div>
                  <strong>{{ displayName }}</strong>
                  <p>{{ session.lastMessagePreview || session.suggestedName || session.title || '暂无对话内容' }}</p>
                  <span>{{ session.status === 'APPLIED' ? '已应用' : '草稿' }} · {{ formatDate(session.updatedAt) }}</span>
                </div>
                <el-button :loading="v2ImportingId === session.id" type="primary" @click="importV2Session(session.id)">
                  导入
                </el-button>
              </article>
            </section>
          </section>
        </div>
      </div>
      <template #footer>
        <el-button @click="v2ImportDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight } from '@element-plus/icons-vue'
import { groupGeoNamedItemsByCategory } from '@/utils/geoVersionGroups'
import {
  archiveGeoV3Version,
  applyGeoV3VersionDraftSession,
  batchUpdateGeoV3Versions,
  createGeoV3BatchTxtJob,
  createGeoV3VariableSet,
  createGeoV3Version,
  createGeoV3VersionDraft,
  createGeoV3VersionDraftSession,
  createGeoV3VariableSetDraft,
  deleteGeoV3VariableSet,
  deleteGeoV3VersionDraftSession,
  getGeoPromptEngineV2VersionDraftSessions,
  getGeoV3FixedRules,
  getGeoV3BatchTxtJob,
  getGeoV3VersionDraftSessions,
  getGeoV3Versions,
  importGeoV3VersionDraftSessionFromV2,
  retryFailedGeoV3BatchTxtJob,
  streamGeoV3VersionDraftSessionChat,
  updateGeoV3FixedRules,
  updateGeoV3VariableSet,
  updateGeoV3Version,
  updateGeoV3VersionDraftSession,
} from '@/api/geo'
import type {
  GeoPromptEngineVersionDraftSession,
  GeoV3BatchTxtJob,
  GeoV3BatchTxtJobItem,
  GeoV3BatchTxtJobItemStatus,
  GeoV3BatchTxtJobStatus,
  GeoV3VariablePickMode,
  GeoV3VariableSet,
  GeoV3VariableSetPayload,
  GeoV3Version,
  GeoV3VersionBatchAction,
  GeoV3VersionDraftChatMessage,
  GeoV3VersionDraftSession,
  GeoV3VersionDraftSuggestion,
  GeoV3VersionDraftVariableSet,
  GeoV3VersionPayload,
} from '@/types/geo'

type VersionForm = GeoV3VersionPayload & { id: number | null }

interface VariableItemForm {
  localKey: string
  name: string
  label: string
  description: string
  pickMode: GeoV3VariablePickMode
  pickCount: number
  candidatesText: string
  isActive: boolean
  sortOrder: number
}

interface VariableSetForm {
  id: number | null
  name: string
  description: string
  isActive: boolean
  sortOrder: number
  items: VariableItemForm[]
}

interface ApplyValidationItem {
  label: string
  passed: boolean
  message: string
  level: 'success' | 'warning' | 'danger'
  blocking: boolean
}

interface BatchTxtFileEntry {
  localKey: string
  fileName: string
  content: string
}

const versions = ref<GeoV3Version[]>([])
const loading = ref(false)
const saving = ref(false)
const selectedVersionIds = ref<number[]>([])
const batchVersionUpdating = ref(false)
const drafting = ref(false)
const draftDialogVisible = ref(false)
const fixedRulesText = ref('')
const fixedRulesUpdatedAt = ref('')
const fixedRulesLoading = ref(false)
const fixedRulesSaving = ref(false)
const variableStructuring = ref(false)

const chatDialogVisible = ref(false)
const chatSessions = ref<GeoV3VersionDraftSession[]>([])
const chatSessionsLoading = ref(false)
const activeChatSessionId = ref<number | null>(null)
const chatSaving = ref(false)
const chatStreaming = ref(false)
const chatApplying = ref(false)
const chatMessages = ref<GeoV3VersionDraftChatMessage[]>([])
const chatInput = ref('')
const chatInputMode = ref<'text' | 'url'>('text')
const chatMessagesRef = ref<HTMLElement | null>(null)
let chatAbortController: AbortController | null = null

const applyProgressDialogVisible = ref(false)
const applyPreviewDialogVisible = ref(false)
const applyProgressActive = ref(0)
const applyProgressPercent = ref(0)
const applyProgressText = ref('')
const applyProgressSteps = ['保存对话', '整理规则', '校验内容', '整理变量', '等待确认']
const pendingApplyDraft = ref<GeoV3VersionDraftSuggestion | null>(null)
const pendingApplyRawContent = ref('')
const applyReviewFeedback = ref('')
const applyValidationItems = ref<ApplyValidationItem[]>([])
const hasBlockingApplyIssues = computed(() => {
  return applyValidationItems.value.some((item) => item.blocking && !item.passed)
})

const groupedVersions = computed(() => (
  groupGeoNamedItemsByCategory(versions.value, (item) => item.name, (item) => item.id)
))
const selectedVersionIdSet = computed(() => new Set(selectedVersionIds.value))
const allVersionsSelected = computed(() => (
  versions.value.length > 0 && versions.value.every((item) => selectedVersionIdSet.value.has(item.id))
))
const versionSelectionIndeterminate = computed(() => (
  selectedVersionIds.value.length > 0 && !allVersionsSelected.value
))
const collapsedVersionCategories = ref<Set<string>>(new Set())
const collapsedVersionGroups = ref<Set<string>>(new Set())

const groupedChatSessions = computed(() => (
  groupGeoNamedItemsByCategory(chatSessions.value, (item) => item.title, (item) => item.id)
))

const groupedV2Sessions = computed(() => (
  groupGeoNamedItemsByCategory(v2Sessions.value, (item) => item.title, (item) => item.id)
))

const updateCollapsedSet = (source: Set<string>, key: string, collapsed: boolean) => {
  const next = new Set(source)
  if (collapsed) {
    next.add(key)
  } else {
    next.delete(key)
  }
  return next
}

const isVersionCategoryCollapsed = (key: string) => collapsedVersionCategories.value.has(key)
const isVersionGroupCollapsed = (key: string) => collapsedVersionGroups.value.has(key)

const toggleVersionCategory = (key: string) => {
  collapsedVersionCategories.value = updateCollapsedSet(
    collapsedVersionCategories.value,
    key,
    !isVersionCategoryCollapsed(key)
  )
}

const toggleVersionGroup = (key: string) => {
  collapsedVersionGroups.value = updateCollapsedSet(
    collapsedVersionGroups.value,
    key,
    !isVersionGroupCollapsed(key)
  )
}

const expandAllVersionFolders = () => {
  collapsedVersionCategories.value = new Set()
  collapsedVersionGroups.value = new Set()
}

const collapseAllVersionFolders = () => {
  collapsedVersionCategories.value = new Set(groupedVersions.value.map((category) => category.key))
  collapsedVersionGroups.value = new Set(groupedVersions.value.flatMap((category) => category.groups.map((group) => group.key)))
}

const isVersionSelected = (id: number) => selectedVersionIdSet.value.has(id)

const toggleVersionSelection = (id: number, checked: unknown) => {
  const next = new Set(selectedVersionIds.value)
  if (checked === true) {
    next.add(id)
  } else {
    next.delete(id)
  }
  selectedVersionIds.value = [...next]
}

const toggleAllVersions = (checked: unknown) => {
  selectedVersionIds.value = checked === true ? versions.value.map((item) => item.id) : []
}

const activeChatSession = computed(() => {
  return chatSessions.value.find((session) => session.id === activeChatSessionId.value) ?? null
})

const v2ImportDialogVisible = ref(false)
const v2SessionsLoading = ref(false)
const v2ImportingId = ref<number | null>(null)
const v2Sessions = ref<GeoPromptEngineVersionDraftSession[]>([])

const createEmptyForm = (): VersionForm => ({
  id: null,
  name: '',
  description: '',
  sourceArticleUrl: '',
  sourceArticleText: '',
  sourceArticleTitle: '',
  ruleText: '',
  structureRules: '',
  titleRules: '',
  paragraphRules: '',
  seoGeoRules: '',
  forbiddenRules: '',
  notes: '',
  isActive: true,
  sortOrder: 0,
})

const form = reactive<VersionForm>(createEmptyForm())
const variableForm = reactive<VariableSetForm>({
  id: null,
  name: '',
  description: '',
  isActive: true,
  sortOrder: 0,
  items: [],
})
const draftForm = reactive({
  articleUrl: '',
  articleText: '',
  notes: '',
})
const DEFAULT_V3_VERSION_DRAFT_MODEL = 'claude-opus-4-8'
const MIN_USABLE_RULE_TEXT_LENGTH = 2000
const BATCH_DRAFT_FILE_EXTENSIONS = ['.txt', '.md']
const chatForm = reactive({
  title: '',
  articleUrl: '',
  articleText: '',
  notes: '',
  model: DEFAULT_V3_VERSION_DRAFT_MODEL,
})

const batchTxtDialogVisible = ref(false)
const batchTxtSubmitting = ref(false)
const batchTxtRefreshing = ref(false)
const batchTxtRetrying = ref(false)
const batchTxtFileInputRef = ref<HTMLInputElement | null>(null)
const batchTxtFiles = ref<BatchTxtFileEntry[]>([])
const batchTxtRequirementsText = ref('')
const currentBatchTxtJob = ref<GeoV3BatchTxtJob | null>(null)
const batchTxtForm = reactive({
  productCategory: '',
  model: DEFAULT_V3_VERSION_DRAFT_MODEL,
})
let batchTxtPollingTimer: number | null = null

const createVariableItem = (index = 0): VariableItemForm => ({
  localKey: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name: '',
  label: '',
  description: '',
  pickMode: 'ONE',
  pickCount: 1,
  candidatesText: '',
  isActive: true,
  sortOrder: index,
})

const composeLegacyRuleText = (item: GeoV3Version) => {
  return [
    ['文章结构规则', item.structureRules],
    ['标题规则', item.titleRules],
    ['段落规则', item.paragraphRules],
    ['SEO / GEO 布局', item.seoGeoRules],
    ['禁用项', item.forbiddenRules],
    ['备注', item.notes],
  ]
    .map(([title, content]) => {
      const text = String(content || '').trim()
      return text ? `## ${title}\n${text}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

const loadFixedRules = async () => {
  fixedRulesLoading.value = true
  try {
    const fixedRules = await getGeoV3FixedRules()
    fixedRulesText.value = fixedRules.ruleText
    fixedRulesUpdatedAt.value = fixedRules.updatedAt
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 固定规则加载失败')
  } finally {
    fixedRulesLoading.value = false
  }
}

const saveFixedRules = async () => {
  fixedRulesSaving.value = true
  try {
    const saved = await updateGeoV3FixedRules(fixedRulesText.value)
    fixedRulesText.value = saved.ruleText
    fixedRulesUpdatedAt.value = saved.updatedAt
    ElMessage.success('V3 固定规则已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 固定规则保存失败')
  } finally {
    fixedRulesSaving.value = false
  }
}

const loadVersions = async () => {
  loading.value = true
  try {
    const loadedVersions = await getGeoV3Versions()
    versions.value = loadedVersions

    const availableIds = new Set(loadedVersions.map((item) => item.id))
    selectedVersionIds.value = selectedVersionIds.value.filter((id) => availableIds.has(id))

    const currentVersion = form.id
      ? loadedVersions.find((item) => item.id === form.id) ?? null
      : null
    if (currentVersion) {
      selectVersion(currentVersion)
    } else {
      if (form.id) resetForm()
      if (loadedVersions.length > 0) selectVersion(loadedVersions[0])
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 版本加载失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, createEmptyForm())
  resetVariableForm()
}

const selectVersion = (item: GeoV3Version) => {
  Object.assign(form, {
    id: item.id,
    name: item.name,
    description: item.description,
    sourceArticleUrl: item.sourceArticleUrl,
    sourceArticleText: item.sourceArticleText,
    sourceArticleTitle: item.sourceArticleTitle,
    ruleText: item.ruleText || composeLegacyRuleText(item),
    structureRules: item.structureRules,
    titleRules: item.titleRules,
    paragraphRules: item.paragraphRules,
    seoGeoRules: item.seoGeoRules,
    forbiddenRules: item.forbiddenRules,
    notes: item.notes,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  })

  const versionVariableSets = item.variableSets ?? []
  const boundVariableSet = versionVariableSets.find((set) => set.isActive) ?? versionVariableSets[0] ?? null
  if (boundVariableSet) {
    selectVariableSet(boundVariableSet)
  } else {
    resetVariableForm()
  }
}

const buildPayload = (): GeoV3VersionPayload => ({
  name: form.name,
  description: form.description,
  sourceArticleUrl: form.sourceArticleUrl,
  sourceArticleText: form.sourceArticleText,
  sourceArticleTitle: form.sourceArticleTitle,
  ruleText: form.ruleText,
  structureRules: form.ruleText,
  titleRules: '',
  paragraphRules: '',
  seoGeoRules: '',
  forbiddenRules: '',
  notes: form.notes,
  isActive: form.isActive,
  sortOrder: form.sortOrder,
})

const resetVariableForm = () => {
  Object.assign(variableForm, {
    id: null,
    name: '',
    description: '',
    isActive: true,
    sortOrder: 0,
    items: [],
  })
}

const selectVariableSet = (item: GeoV3VariableSet) => {
  Object.assign(variableForm, {
    id: item.id,
    name: item.name,
    description: item.description,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    items: item.items.map((variableItem, index) => ({
      localKey: `${variableItem.id}-${index}`,
      name: variableItem.name,
      label: variableItem.label,
      description: variableItem.description,
      pickMode: variableItem.pickMode,
      pickCount: Math.max(1, variableItem.pickMax || variableItem.pickMin || 1),
      candidatesText: variableItem.candidates.join('\n'),
      isActive: variableItem.isActive,
      sortOrder: variableItem.sortOrder,
    })),
  })
}

const applyVariableSetDraft = (draft: GeoV3VersionDraftVariableSet | null | undefined) => {
  if (!draft || !draft.items?.length) {
    resetVariableForm()
    return
  }

  Object.assign(variableForm, {
    id: null,
    name: draft.name || (form.name ? `${form.name}变量池` : ''),
    description: draft.description || '',
    isActive: draft.isActive !== false,
    sortOrder: draft.sortOrder ?? 0,
    items: (draft.items ?? []).map((item, index) => ({
      localKey: `draft-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      name: item.name || `variable_${index + 1}`,
      label: item.label || `变量 ${index + 1}`,
      description: item.description || '',
      pickMode: item.pickMode === 'MANY' ? 'MANY' : 'ONE',
      pickCount: Math.max(1, item.pickMax || item.pickMin || 1),
      candidatesText: (item.candidates ?? []).join('\n'),
      isActive: item.isActive !== false,
      sortOrder: item.sortOrder ?? index,
    })),
  })
}

const addVariableItem = () => {
  if (!variableForm.name.trim() && form.name.trim()) {
    variableForm.name = `${form.name.trim()}变量池`
  }
  variableForm.items.push(createVariableItem(variableForm.items.length))
}

const removeVariableItem = (index: number) => {
  variableForm.items.splice(index, 1)
}

const toLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)

const normalizePickCountValue = (value: unknown) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? Math.max(1, Math.floor(nextValue)) : 1
}

const getPickCount = (item: VariableItemForm) => {
  return item.pickMode === 'ONE' ? 1 : normalizePickCountValue(item.pickCount)
}

const handlePickModeChange = (item: VariableItemForm) => {
  item.pickCount = getPickCount(item)
}

const updatePickCountFromEvent = (item: VariableItemForm, event: Event) => {
  const target = event.target as HTMLInputElement | null
  item.pickCount = normalizePickCountValue(target?.value)
}

const normalizePickCount = (item: VariableItemForm) => {
  item.pickCount = getPickCount(item)
}

const stepPickCount = (item: VariableItemForm, step: number) => {
  if (item.pickMode === 'ONE') return
  item.pickCount = Math.max(1, getPickCount(item) + step)
}

const hasVariableDraft = () => {
  return Boolean(
    variableForm.id ||
    variableForm.name.trim() ||
    variableForm.description.trim() ||
    variableForm.items.some((item) =>
      item.name.trim() ||
      item.label.trim() ||
      item.description.trim() ||
      item.candidatesText.trim()
    )
  )
}

const validateVariableItems = () => {
  if (!hasVariableDraft()) return true

  if (!variableForm.name.trim()) {
    ElMessage.warning('请填写变量池名称')
    return false
  }

  if (variableForm.items.length === 0) {
    ElMessage.warning('请至少新增 1 个变量，或删除当前变量池')
    return false
  }

  for (const item of variableForm.items) {
    const label = item.label || item.name || '未命名变量'
    const candidates = toLines(item.candidatesText)
    const pickCount = getPickCount(item)

    if (!item.name.trim()) {
      ElMessage.warning(`请填写变量“${label}”的字段名`)
      return false
    }

    if (!item.label.trim()) {
      ElMessage.warning(`请填写变量“${label}”的显示名称`)
      return false
    }

    if (candidates.length === 0) {
      ElMessage.warning(`变量“${label}”至少需要 1 个候选值`)
      return false
    }

    if (pickCount > candidates.length) {
      ElMessage.warning(`变量“${label}”的抽取数量不能超过候选值数量`)
      return false
    }
  }

  return true
}

const buildVariablePayload = (versionId: number): GeoV3VariableSetPayload => ({
  versionId,
  name: variableForm.name,
  description: variableForm.description,
  isActive: variableForm.isActive,
  sortOrder: variableForm.sortOrder,
  items: variableForm.items.map((item) => ({
    name: item.name,
    label: item.label,
    description: item.description,
    pickMode: item.pickMode,
    pickMin: getPickCount(item),
    pickMax: getPickCount(item),
    candidates: toLines(item.candidatesText),
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  })),
})

const saveVersion = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请填写版本名称')
    return
  }
  if (!form.ruleText.trim()) {
    ElMessage.warning('请填写版本规则内容')
    return
  }
  if (!validateVariableItems()) return

  saving.value = true
  try {
    const saved = form.id
      ? await updateGeoV3Version(form.id, buildPayload())
      : await createGeoV3Version(buildPayload())
    const shouldSaveVariables = hasVariableDraft()
    let savedVariableSet: GeoV3VariableSet | null = null
    if (shouldSaveVariables) {
      const variablePayload = buildVariablePayload(saved.id)
      savedVariableSet = variableForm.id
        ? await updateGeoV3VariableSet(variableForm.id, variablePayload)
        : await createGeoV3VariableSet(variablePayload)
    }
    ElMessage.success('V3 版本已保存')
    await loadVersions()
    const nextVersion = versions.value.find((item) => item.id === saved.id)
    if (nextVersion) {
      selectVersion(nextVersion)
    } else {
      selectVersion({ ...saved, variableSets: savedVariableSet ? [savedVariableSet] : [] })
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

const runVersionBatchAction = async (action: GeoV3VersionBatchAction) => {
  const ids = [...selectedVersionIds.value]
  if (ids.length === 0) {
    ElMessage.warning('请先勾选要处理的版本')
    return
  }

  const isArchive = action === 'ARCHIVE'
  const actionLabel = isArchive ? '归档' : '暂停'
  const message = isArchive
    ? `归档后，这 ${ids.length} 个版本会从版本管理、Prompt 生成和纯版本生成中隐藏，历史生成记录仍会保留。确认归档？`
    : `暂停后，这 ${ids.length} 个版本仍会保留在列表中，但不能再用于生成。确认暂停？`

  try {
    await ElMessageBox.confirm(message, `批量${actionLabel}版本`, {
      type: 'warning',
      confirmButtonText: `确认${actionLabel}`,
      cancelButtonText: '取消',
    })
    batchVersionUpdating.value = true
    const result = await batchUpdateGeoV3Versions(ids, action)
    selectedVersionIds.value = []
    await loadVersions()
    ElMessage.success(`已${actionLabel} ${result.affectedCount} 个版本`)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : `批量${actionLabel}失败`)
    }
  } finally {
    batchVersionUpdating.value = false
  }
}

const batchPauseVersions = () => runVersionBatchAction('PAUSE')
const batchArchiveVersions = () => runVersionBatchAction('ARCHIVE')

const removeVersion = async () => {
  if (!form.id) return
  try {
    await ElMessageBox.confirm('归档后，这个版本会从版本管理、Prompt 生成和纯版本生成中隐藏，历史生成记录仍会保留。确认归档？', '归档 V3 版本', {
      type: 'warning',
      confirmButtonText: '确认归档',
      cancelButtonText: '取消',
    })
    await archiveGeoV3Version(form.id)
    ElMessage.success('版本已归档')
    resetForm()
    await loadVersions()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '归档失败')
    }
  }
}

const removeVariableSet = async () => {
  if (!variableForm.id) return
  try {
    await ElMessageBox.confirm('确认删除当前版本绑定的变量池？历史生成记录中的快照仍会保留。', '删除变量池', {
      type: 'warning',
    })
    await deleteGeoV3VariableSet(variableForm.id)
    ElMessage.success('变量池已删除')
    resetVariableForm()
    await loadVersions()
    const currentVersion = versions.value.find((item) => item.id === form.id)
    if (currentVersion) selectVersion(currentVersion)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

const applyDraftToForm = (draft: GeoV3VersionDraftSuggestion) => {
  const ruleText = cleanChatFallbackRuleText(draft.ruleText)

  Object.assign(form, {
    ...createEmptyForm(),
    name: draft.name,
    description: draft.description,
    sourceArticleUrl: draft.sourceArticleUrl,
    sourceArticleText: draft.sourceArticleText || draftForm.articleText,
    sourceArticleTitle: draft.sourceArticleTitle,
    ruleText,
    structureRules: ruleText,
    notes: draft.notes,
  })
  applyVariableSetDraft(draft.variableSetDraft)
}

const applyStoredChatSuggestionToForm = (session: GeoV3VersionDraftSession | null) => {
  const ruleText = cleanChatFallbackRuleText(session?.suggestedRuleText ?? '')
  if (!session || !ruleText) return false

  applyDraftToForm({
    name: session.suggestedName || session.title || 'AI 建版规则',
    description: session.suggestedDescription,
    sourceArticleUrl: session.articleUrl,
    sourceArticleText: session.articleText,
    sourceArticleTitle: '',
    ruleText,
    notes: session.notes,
    variableSetDraft: session.suggestedVariableSetDraft,
  })

  return true
}

const getLatestAssistantContent = (session: GeoV3VersionDraftSession | null) => {
  return [...(session?.messages ?? chatMessages.value)]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content.trim())
    ?.content.trim() || ''
}

const cleanChatFallbackRuleText = (content: string) => {
  const lines = content.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim().split('\n')
  const ruleTextHeadingIndex = findChatRuleTextHeadingIndex(lines)
  const ruleStartIndex = ruleTextHeadingIndex >= 0
    ? ruleTextHeadingIndex + 1
    : findChatRuleStartIndex(lines)
  const candidateLines = ruleStartIndex >= 0 ? lines.slice(ruleStartIndex) : lines
  const variableHeadingIndex = candidateLines.findIndex((line) => isChatVariableHeading(line.trim()))
  const ruleLines = variableHeadingIndex === -1
    ? candidateLines
    : candidateLines.slice(0, variableHeadingIndex)

  const cleaned = ruleLines
    .filter((line) => {
      const trimmed = line.trim()
      if (/^-{3,}$/.test(trimmed)) return false
      if (/^正式版整理完毕/.test(trimmed)) return false
      if (/^如需/.test(trimmed)) return false
      return true
    })
    .join('\n')
    .trim()

  return isUsableChatRuleText(cleaned) ? cleaned : ''
}

const findChatRuleTextHeadingIndex = (lines: string[]) => (
  lines.findIndex((line) => /^#{1,6}\s*ruleText\b/i.test(line.trim()))
)

const findChatRuleStartIndex = (lines: string[]) => (
  lines.findIndex((line) => {
    const trimmed = line.trim()
    if (/^\*\*版本名称[：:]/.test(trimmed)) return true
    if (/^#{1,6}\s*V3\b/i.test(trimmed)) return true
    if (/^#{1,6}\s*.*版本规则/.test(trimmed)) return true
    return /^#{1,6}\s*(文章定位|标题规则|标题|开头规则|主体结构|文章结构|品牌段落|段落规则|排序规则|SEO|GEO|禁用项)/i.test(trimmed)
  })
)

const isChatVariableHeading = (line: string) => (
  /^#{1,6}\s*(variablesetdraft\b|变量池|变量候选|差异化变量|变量组\b)/i.test(line)
  || /^\*\*\s*(variablesetdraft\b|变量池|变量候选|差异化变量|变量组\b)/i.test(line)
  || /^variablesetdraft\s*[：:（(候选]/i.test(line)
)

const isUsableChatRuleText = (ruleText: string) => {
  if (!ruleText) return false

  const headingCount = ruleText.split('\n').filter((line) => {
    const trimmed = line.trim()
    return /^#{1,6}\s+/.test(trimmed) || /^\*\*.*(规则|版本名称|适用品类).*[:：]/.test(trimmed)
  }).length
  const hasRuleKeywords = /(标题规则|开头规则|文章结构|主体结构|品牌段落|段落规则|SEO|GEO|禁用项|结尾规则)/.test(ruleText)
  const looksLikeConversationalSummary =
    /(下一步你可以|需要做哪一步|目前\s*V3\s*版本规则整理完毕|已完成的内容|好的，variableSetDraft)/.test(ruleText)

  if (ruleText.length >= MIN_USABLE_RULE_TEXT_LENGTH) return true
  if (looksLikeConversationalSummary && headingCount < 2) return false
  if (ruleText.length < 600 && headingCount < 2) return false
  return headingCount >= 2 || hasRuleKeywords
}

const setApplyProgress = (active: number, percent: number, text: string) => {
  applyProgressActive.value = active
  applyProgressPercent.value = percent
  applyProgressText.value = text
}

const countRuleHeadings = (ruleText: string) => (
  ruleText.split('\n').filter((line) => {
    const trimmed = line.trim()
    return /^#{1,6}\s+/.test(trimmed) || /^\*\*.*(规则|版本名称|适用品类).*[:：]/.test(trimmed)
  }).length
)

const buildApplyValidationItems = (draft: GeoV3VersionDraftSuggestion): ApplyValidationItem[] => {
  const ruleText = draft.ruleText.trim()
  const headingCount = countRuleHeadings(ruleText)
  const missingSections = [
    ['标题', /标题规则|标题/],
    ['开头', /开头规则|开头/],
    ['主体结构', /主体结构|文章结构|品牌段落|段落规则/],
    ['SEO/GEO', /SEO|GEO/],
    ['禁用项', /禁用项|禁止|不得/],
  ]
    .filter(([, pattern]) => !(pattern as RegExp).test(ruleText))
    .map(([label]) => label)
  const conversationalPattern = /(下一步你可以|需要做哪一步|目前\s*V3\s*版本规则整理完毕|已完成的内容|好的，variableSetDraft|请问还需要|可以继续)/i
  const variableLeakPattern = /(^|\n)\s*(#{1,6}\s*)?(variableSetDraft\b|变量池|变量候选|差异化变量|变量组\b)/i
  const firstLine = ruleText.split('\n').find((line) => line.trim())?.trim() || ''

  return [
    {
      label: '规则正文完整度',
      passed: ruleText.length >= MIN_USABLE_RULE_TEXT_LENGTH,
      message: ruleText.length >= MIN_USABLE_RULE_TEXT_LENGTH
        ? `当前约 ${ruleText.length} 字，已超过 ${MIN_USABLE_RULE_TEXT_LENGTH} 字。`
        : `当前约 ${ruleText.length} 字，需要至少 ${MIN_USABLE_RULE_TEXT_LENGTH} 字。`,
      level: 'danger',
      blocking: true,
    },
    {
      label: '关键规则覆盖',
      passed: missingSections.length <= 1,
      message: missingSections.length === 0
        ? '已覆盖标题、开头、主体结构、SEO/GEO、禁用项等关键规则。'
        : `缺少或不明显：${missingSections.join('、')}。`,
      level: missingSections.length <= 2 ? 'warning' : 'danger',
      blocking: missingSections.length > 2,
    },
    {
      label: '聊天语过滤',
      passed: !conversationalPattern.test(ruleText),
      message: conversationalPattern.test(ruleText)
        ? '检测到“下一步你可以/已完成内容”等对话式内容。'
        : '未检测到明显聊天总结语。',
      level: 'danger',
      blocking: true,
    },
    {
      label: '变量池边界',
      passed: !variableLeakPattern.test(firstLine) && !/^variableSetDraft\b/i.test(firstLine),
      message: (!variableLeakPattern.test(firstLine) && !/^variableSetDraft\b/i.test(firstLine))
        ? '版本规则没有以变量池或 variableSetDraft 开头。'
        : '版本规则开头像变量池内容，不能直接应用。',
      level: 'danger',
      blocking: true,
    },
    {
      label: '变量池草稿',
      passed: draft.variableSetDraft.items.length > 0,
      message: draft.variableSetDraft.items.length > 0
        ? `已整理 ${draft.variableSetDraft.items.length} 个变量，可继续手动调整。`
        : '暂未识别变量池，不影响版本规则，但建议确认是否需要手动补充。',
      level: 'warning',
      blocking: false,
    },
  ]
}

const normalizeDraftForReview = (draft: GeoV3VersionDraftSuggestion): GeoV3VersionDraftSuggestion => {
  const ruleText = cleanChatFallbackRuleText(draft.ruleText)

  return {
    ...draft,
    ruleText,
  }
}

const toFallbackVariableName = (label: string, index: number) => {
  const asciiName = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return asciiName || `variable_${index + 1}`
}

const parseChatFallbackVariableSet = (
  content: string,
  fallbackName: string
): GeoV3VersionDraftVariableSet => {
  const lines = content.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim().split('\n')
  const variableHeadingIndex = lines.findIndex((line) =>
    /^#{1,4}\s*(variablesetdraft\b|变量池|变量候选|差异化变量)/i.test(line.trim())
  )
  const variableLines = variableHeadingIndex === -1 ? [] : lines.slice(variableHeadingIndex + 1)
  const items = variableLines
    .map((line, index) => {
      const match = line.trim().match(/^[-*]\s*[`"'“”]?[\[【［]?(.+?)[\]】］]?[`"'“”]?\s*[：:]\s*(.+)$/)
      if (!match) return null

      const label = match[1].replace(/[`"'“”]/g, '').replace(/\s+/g, ' ').trim()
      const description = match[2].trim()
      if (!label || !description) return null

      const splitCandidates = description.split(/[、；;]/).map((candidate) => candidate.trim()).filter(Boolean)
      const candidates = splitCandidates.length > 1 ? splitCandidates : [description]

      return {
        name: toFallbackVariableName(label, index),
        label,
        description,
        candidates,
        pickMode: 'ONE' as const,
        pickMin: 1,
        pickMax: 1,
        isActive: true,
        sortOrder: index,
      }
    })
    .filter(Boolean) as GeoV3VersionDraftVariableSet['items']

  return {
    name: fallbackName,
    description: items.length > 0 ? '从 AI 对话中的变量池草稿提取，候选值和抽取数量可继续手动调整。' : '',
    isActive: true,
    sortOrder: 0,
    items,
  }
}

const buildDraftFromLatestAssistantMessage = (
  session: GeoV3VersionDraftSession | null
): GeoV3VersionDraftSuggestion | null => {
  const assistantContent = getLatestAssistantContent(session)

  if (!assistantContent) return null

  const ruleText = cleanChatFallbackRuleText(assistantContent)
  if (!ruleText) return null

  const name = session?.suggestedName || session?.title || chatForm.title || 'AI 建版规则'

  return {
    name,
    description: session?.suggestedDescription || '系统已使用最近一次 AI 回复作为 V3 版本规则草稿。',
    sourceArticleUrl: session?.articleUrl || (chatInputMode.value === 'url' ? chatForm.articleUrl : ''),
    sourceArticleText: session?.articleText || (chatInputMode.value === 'text' ? chatForm.articleText : ''),
    sourceArticleTitle: '',
    ruleText,
    notes: session?.notes || chatForm.notes,
    variableSetDraft: parseChatFallbackVariableSet(assistantContent, `${name}变量池`),
  }
}

const saveChatDraftSuggestion = async (sessionId: number, draft: GeoV3VersionDraftSuggestion) => {
  const ruleText = cleanChatFallbackRuleText(draft.ruleText)

  await updateGeoV3VersionDraftSession(sessionId, {
    status: 'APPLIED',
    suggestedName: draft.name,
    suggestedDescription: draft.description,
    suggestedRuleText: ruleText,
    suggestedVariableSetDraft: draft.variableSetDraft,
  })
}

const structureVariableSetDraft = async (options: { rawContent?: string; automatic?: boolean } = {}) => {
  if (variableStructuring.value) return

  const rawContent = options.rawContent?.trim() || getLatestAssistantContent(activeChatSession.value)
  const ruleText = form.ruleText.trim()

  if (!rawContent && !ruleText) {
    if (!options.automatic) ElMessage.warning('请先生成或填写版本规则内容')
    return
  }

  variableStructuring.value = true

  try {
    const draft = await createGeoV3VariableSetDraft({
      versionName: form.name,
      ruleText,
      rawContent,
      notes: form.notes,
      model: chatForm.model || DEFAULT_V3_VERSION_DRAFT_MODEL,
    })

    if (draft.items.length === 0) {
      ElMessage.warning('版本规则已应用，但变量池未自动识别，可手动补充或再次点击“重新整理变量池”')
      return
    }

    applyVariableSetDraft(draft)
    ElMessage.success(options.automatic ? '变量池已自动整理' : '变量池已重新整理')
  } catch (error) {
    ElMessage.warning(
      error instanceof Error
        ? `版本规则已应用，变量池整理失败：${error.message}`
        : '版本规则已应用，变量池整理失败，可手动补充'
    )
  } finally {
    variableStructuring.value = false
  }
}

const restructureVariableSet = () => {
  void structureVariableSetDraft()
}

const createDraft = async () => {
  drafting.value = true
  try {
    const draft = await createGeoV3VersionDraft({
      articleUrl: draftForm.articleUrl,
      articleText: draftForm.articleText,
      notes: draftForm.notes,
    })
    applyDraftToForm(draft)
    draftDialogVisible.value = false
    ElMessage.success('草稿已填入编辑区')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '草稿生成失败')
  } finally {
    drafting.value = false
  }
}

const openBatchTxtDialog = () => {
  batchTxtDialogVisible.value = true
}

const chooseBatchTxtFiles = () => {
  batchTxtFileInputRef.value?.click()
}

const toBatchTxtVersionName = (fileName: string) => (
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|\r\n]+/g, '_')
    .trim() || '未命名版本'
)

const isBatchDraftFile = (fileName: string) => {
  const lowerName = fileName.toLowerCase()
  return BATCH_DRAFT_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

const handleBatchTxtFileInput = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])
  if (input) input.value = ''
  if (files.length === 0) return

  const availableSlots = Math.max(0, 20 - batchTxtFiles.value.length)
  const acceptedFiles = files.slice(0, availableSlots)
  if (acceptedFiles.length < files.length) {
    ElMessage.warning('一次最多上传 20 个 TXT/MD 文件，超出的文件已忽略')
  }

  const nextFiles: BatchTxtFileEntry[] = []
  for (const file of acceptedFiles) {
    if (!isBatchDraftFile(file.name)) {
      ElMessage.warning(`${file.name} 不是 TXT/MD 文件，已忽略`)
      continue
    }

    try {
      const content = await file.text()
      if (!content.trim()) {
        ElMessage.warning(`${file.name} 内容为空，已忽略`)
        continue
      }
      if (content.length > 120_000) {
        ElMessage.warning(`${file.name} 超过 120,000 字符，已忽略`)
        continue
      }

      nextFiles.push({
        localKey: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
        fileName: file.name,
        content,
      })
    } catch {
      ElMessage.warning(`${file.name} 读取失败，请确认文件编码后重试`)
    }
  }

  batchTxtFiles.value = [...batchTxtFiles.value, ...nextFiles]
}

const removeBatchTxtFile = (localKey: string) => {
  batchTxtFiles.value = batchTxtFiles.value.filter((file) => file.localKey !== localKey)
}

const clearBatchTxtFiles = () => {
  batchTxtFiles.value = []
}

const clearBatchTxtRequirements = () => {
  batchTxtRequirementsText.value = ''
}

const buildBatchTxtRequirements = () => (
  batchTxtRequirementsText.value.trim() ? [batchTxtRequirementsText.value.trim()] : []
)

const submitBatchTxtJob = async () => {
  if (batchTxtFiles.value.length === 0) {
    ElMessage.warning('请先选择 TXT/MD 文件')
    return
  }

  const requirements = buildBatchTxtRequirements()
  if (requirements.length === 0) {
    ElMessage.warning('请填写建版要求')
    return
  }

  const productCategory = batchTxtForm.productCategory.trim()
  if (!productCategory) {
    ElMessage.warning('请填写产品品类；不填写会影响 AI 判断产品方向，可能导致版本规则和变量池跑偏。')
    return
  }

  batchTxtSubmitting.value = true
  try {
    const job = await createGeoV3BatchTxtJob({
      productCategory,
      model: batchTxtForm.model || DEFAULT_V3_VERSION_DRAFT_MODEL,
      requirements,
      files: batchTxtFiles.value.map((file) => ({
        fileName: file.fileName,
        content: file.content,
      })),
    })
    currentBatchTxtJob.value = job
    startBatchTxtPolling(job.id)
    ElMessage.success('TXT/MD 批量建版任务已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量建版任务创建失败')
  } finally {
    batchTxtSubmitting.value = false
  }
}

const startBatchTxtPolling = (jobId: number) => {
  stopBatchTxtPolling()
  batchTxtPollingTimer = window.setInterval(() => {
    void refreshBatchTxtJob(jobId)
  }, 3000)
  void refreshBatchTxtJob(jobId)
}

const stopBatchTxtPolling = () => {
  if (!batchTxtPollingTimer) return
  window.clearInterval(batchTxtPollingTimer)
  batchTxtPollingTimer = null
}

const refreshBatchTxtJob = async (jobId: number) => {
  batchTxtRefreshing.value = true
  try {
    const job = await getGeoV3BatchTxtJob(jobId)
    currentBatchTxtJob.value = job
    if (isBatchTxtTerminal(job.status)) {
      stopBatchTxtPolling()
      await loadVersions()
      if (chatDialogVisible.value) await loadChatSessions()
    }
  } catch (error) {
    stopBatchTxtPolling()
    ElMessage.error(error instanceof Error ? error.message : '批量建版任务刷新失败')
  } finally {
    batchTxtRefreshing.value = false
  }
}

const refreshCurrentBatchTxtJob = async () => {
  if (!currentBatchTxtJob.value) return
  await refreshBatchTxtJob(currentBatchTxtJob.value.id)
}

const retryCurrentBatchTxtFailedItems = async () => {
  const job = currentBatchTxtJob.value
  if (!job || job.failedCount === 0 || !isBatchTxtTerminal(job.status)) return

  batchTxtRetrying.value = true
  try {
    const retriedJob = await retryFailedGeoV3BatchTxtJob(job.id)
    currentBatchTxtJob.value = retriedJob
    startBatchTxtPolling(retriedJob.id)
    ElMessage.success(`已重新排队 ${job.failedCount} 个失败项`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '失败项重新排队失败')
  } finally {
    batchTxtRetrying.value = false
  }
}

const openBatchTxtVersion = async (item: GeoV3BatchTxtJobItem) => {
  if (!item.versionId) return
  await loadVersions()
  const version = versions.value.find((current) => current.id === item.versionId)
  if (version) {
    selectVersion(version)
    batchTxtDialogVisible.value = false
  } else {
    ElMessage.warning('版本已生成，但当前列表暂未找到，请刷新后再看')
  }
}

const openBatchTxtSession = async (item: GeoV3BatchTxtJobItem) => {
  if (!item.draftSessionId) return
  chatDialogVisible.value = true
  await loadChatSessions()
  const session = chatSessions.value.find((current) => current.id === item.draftSessionId)
  if (session) {
    selectChatSession(session)
  } else {
    ElMessage.warning('AI 对话记录暂未加载到，请刷新会话列表')
  }
}

const isBatchTxtTerminal = (status: GeoV3BatchTxtJobStatus) => (
  status === 'COMPLETED' || status === 'PARTIAL_FAILED' || status === 'FAILED'
)

const getBatchTxtJobStatusLabel = (status: GeoV3BatchTxtJobStatus) => {
  const labels: Record<GeoV3BatchTxtJobStatus, string> = {
    QUEUED: '等待中',
    RUNNING: '生成中',
    COMPLETED: '已完成',
    PARTIAL_FAILED: '部分失败',
    FAILED: '失败',
  }
  return labels[status] || status
}

const getBatchTxtItemStatusLabel = (status: GeoV3BatchTxtJobItemStatus) => {
  const labels: Record<GeoV3BatchTxtJobItemStatus, string> = {
    QUEUED: '等待中',
    RUNNING: '生成中',
    SUCCEEDED: '已成功',
    SKIPPED: '已跳过',
    FAILED: '失败',
  }
  return labels[status] || status
}

const getBatchTxtJobStatusTagType = (status: GeoV3BatchTxtJobStatus) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'PARTIAL_FAILED') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

const getBatchTxtItemStatusTagType = (status: GeoV3BatchTxtJobItemStatus) => {
  if (status === 'SUCCEEDED') return 'success'
  if (status === 'SKIPPED') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'info'
}

const getDraftSessionSourceLabel = (sourceType: GeoV3VersionDraftSession['sourceType']) => {
  const labels: Record<GeoV3VersionDraftSession['sourceType'], string> = {
    MANUAL_CHAT: '手动对话',
    V2_IMPORT: 'V2 导入',
    TXT_BATCH: 'TXT/MD 批量',
  }
  return labels[sourceType] || '手动对话'
}

const getDraftSessionSourceTagType = (sourceType: GeoV3VersionDraftSession['sourceType']) => {
  if (sourceType === 'TXT_BATCH') return 'success'
  if (sourceType === 'V2_IMPORT') return 'warning'
  return 'info'
}

const loadChatSessions = async () => {
  chatSessionsLoading.value = true
  try {
    chatSessions.value = await getGeoV3VersionDraftSessions()
    if (activeChatSessionId.value) {
      const current = chatSessions.value.find((item) => item.id === activeChatSessionId.value)
      if (current) selectChatSession(current)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V3 AI 会话加载失败')
  } finally {
    chatSessionsLoading.value = false
  }
}

const selectChatSession = (session: GeoV3VersionDraftSession) => {
  activeChatSessionId.value = session.id
  Object.assign(chatForm, {
    title: session.title,
    articleUrl: session.articleUrl,
    articleText: session.articleText,
    notes: session.notes,
    model: session.model || DEFAULT_V3_VERSION_DRAFT_MODEL,
  })
  chatMessages.value = [...session.messages]
  chatInputMode.value = session.articleUrl ? 'url' : 'text'
  void scrollChatToBottom()
}

const createChatSession = async () => {
  try {
    const session = await createGeoV3VersionDraftSession({
      title: form.name ? `${form.name} AI 建版` : undefined,
      articleUrl: form.sourceArticleUrl,
      articleText: '',
      notes: form.notes,
      model: chatForm.model || DEFAULT_V3_VERSION_DRAFT_MODEL,
      messages: [],
    })
    chatSessions.value = [session, ...chatSessions.value.filter((item) => item.id !== session.id)]
    selectChatSession(session)
    ElMessage.success('已新建 V3 AI 会话')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '新建会话失败')
  }
}

const openChatDialog = async () => {
  chatDialogVisible.value = true
  await loadChatSessions()
  if (!activeChatSessionId.value) {
    if (chatSessions.value.length > 0) {
      selectChatSession(chatSessions.value[0])
    } else {
      await createChatSession()
    }
  }
}

const saveActiveChatSession = async () => {
  if (!activeChatSessionId.value) return null
  chatSaving.value = true
  try {
    const session = await updateGeoV3VersionDraftSession(activeChatSessionId.value, {
      title: chatForm.title,
      articleUrl: chatInputMode.value === 'url' ? chatForm.articleUrl : '',
      articleText: chatInputMode.value === 'text' ? chatForm.articleText : '',
      notes: chatForm.notes,
      model: chatForm.model || DEFAULT_V3_VERSION_DRAFT_MODEL,
      messages: chatMessages.value,
    })
    chatSessions.value = [session, ...chatSessions.value.filter((item) => item.id !== session.id)]
    activeChatSessionId.value = session.id
    return session
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存会话失败')
    return null
  } finally {
    chatSaving.value = false
  }
}

const deleteActiveChatSession = async () => {
  if (!activeChatSessionId.value) return
  try {
    await ElMessageBox.confirm('确认删除当前 V3 AI 建版会话？', '删除会话', { type: 'warning' })
    await deleteGeoV3VersionDraftSession(activeChatSessionId.value)
    ElMessage.success('会话已删除')
    activeChatSessionId.value = null
    chatMessages.value = []
    Object.assign(chatForm, {
      title: '',
      articleUrl: '',
      articleText: '',
      notes: '',
      model: DEFAULT_V3_VERSION_DRAFT_MODEL,
    })
    await loadChatSessions()
    if (chatSessions.value.length > 0) selectChatSession(chatSessions.value[0])
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除会话失败')
    }
  }
}

const scrollChatToBottom = async () => {
  await nextTick()
  if (!chatMessagesRef.value) return
  chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
}

const sendChatMessage = async () => {
  const content = chatInput.value.trim()
  if (!content) {
    ElMessage.warning('请输入要和 AI 讨论的内容')
    return
  }

  if (!activeChatSessionId.value) {
    await createChatSession()
  }
  if (!activeChatSessionId.value) return

  chatAbortController?.abort()
  chatAbortController = new AbortController()

  const userMessage: GeoV3VersionDraftChatMessage = {
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  }
  const assistantMessage: GeoV3VersionDraftChatMessage = {
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
  }
  const requestMessages = [...chatMessages.value, userMessage]

  chatMessages.value = [...requestMessages, assistantMessage]
  chatInput.value = ''
  chatStreaming.value = true
  await scrollChatToBottom()

  const savedBeforeStream = await saveActiveChatSession()
  if (!savedBeforeStream) {
    chatMessages.value = chatMessages.value.filter((message) => message !== assistantMessage)
    chatStreaming.value = false
    chatAbortController = null
    return
  }

  let streamError = ''

  try {
    await streamGeoV3VersionDraftSessionChat(savedBeforeStream.id, {
      signal: chatAbortController.signal,
      onEvent(event) {
        if (event.type === 'text' && event.content) {
          assistantMessage.content += event.content
          void scrollChatToBottom()
        }

        if (event.type === 'error') {
          streamError = event.content || 'AI 对话生成失败'
        }
      },
    })

    if (streamError) throw new Error(streamError)

    if (!assistantMessage.content.trim()) {
      assistantMessage.content = '我没有拿到有效回复，请调整材料后再试一次。'
    }
    await saveActiveChatSession()
    await loadChatSessions()
  } catch (error) {
    chatMessages.value = chatMessages.value.filter((message) => message !== assistantMessage)
    await saveActiveChatSession()
    ElMessage.error(error instanceof Error ? error.message : 'AI 对话生成失败')
  } finally {
    chatStreaming.value = false
    chatAbortController = null
    await scrollChatToBottom()
  }
}

const prepareApplyDraftForReview = async (
  draft: GeoV3VersionDraftSuggestion,
  rawContent: string
) => {
  let reviewDraft = normalizeDraftForReview(draft)

  if (!reviewDraft.ruleText) {
    throw new Error('整理结果不像完整版本规则，可能混入了聊天总结或变量池内容。请补充反馈后重新整理。')
  }

  if (reviewDraft.variableSetDraft.items.length === 0 && (rawContent || reviewDraft.ruleText)) {
    try {
      const variableSetDraft = await createGeoV3VariableSetDraft({
        versionName: reviewDraft.name,
        ruleText: reviewDraft.ruleText,
        rawContent,
        notes: reviewDraft.notes,
        model: chatForm.model || DEFAULT_V3_VERSION_DRAFT_MODEL,
      })
      reviewDraft = {
        ...reviewDraft,
        variableSetDraft,
      }
    } catch {
      // 变量池整理失败不阻断版本规则确认，确认弹窗里会提示用户手动补充。
    }
  }

  pendingApplyDraft.value = reviewDraft
  pendingApplyRawContent.value = rawContent
  applyValidationItems.value = buildApplyValidationItems(reviewDraft)
}

const runApplyDraftCompilation = async (feedback = '') => {
  if (!activeChatSessionId.value) {
    ElMessage.warning('请先选择或创建一个 V3 AI 会话')
    return
  }

  chatApplying.value = true
  applyProgressDialogVisible.value = true
  applyPreviewDialogVisible.value = false
  pendingApplyDraft.value = null
  pendingApplyRawContent.value = ''
  applyValidationItems.value = []

  try {
    setApplyProgress(0, 10, '正在保存当前对话，避免使用过期缓存。')
    const savedSession = await saveActiveChatSession()
    if (!savedSession) throw new Error('当前会话保存失败，请稍后重试')
    const currentSession = savedSession ?? activeChatSession.value
    const rawContent = getLatestAssistantContent(currentSession)

    setApplyProgress(1, 35, '正在重新整理正式版本规则，不直接使用聊天缓存。')
    const draft = await applyGeoV3VersionDraftSession(savedSession.id, {
      forceRefresh: true,
      feedback: feedback.trim(),
    })

    setApplyProgress(2, 62, '正在校验 ruleText 是否像完整规则。')
    await prepareApplyDraftForReview(draft, rawContent)

    setApplyProgress(3, 84, '正在整理变量池草稿并准备预览。')
    await loadChatSessions()
    setApplyProgress(4, 100, '整理完成，请确认后再应用到编辑区。')
    applyReviewFeedback.value = ''
    applyProgressDialogVisible.value = false
    applyPreviewDialogVisible.value = true
  } catch (error) {
    applyProgressDialogVisible.value = false
    ElMessage.error(error instanceof Error ? error.message : '应用对话结果失败')
  } finally {
    chatApplying.value = false
  }
}

const applyChatDraft = async () => {
  await runApplyDraftCompilation()
}

const confirmApplyDraft = () => {
  if (!pendingApplyDraft.value) return

  if (hasBlockingApplyIssues.value) {
    ElMessage.warning('当前整理结果还有阻断问题，请重新整理后再应用')
    return
  }

  applyDraftToForm(pendingApplyDraft.value)
  applyPreviewDialogVisible.value = false
  chatDialogVisible.value = false
  ElMessage.success('已确认并填入编辑区')

  if (pendingApplyRawContent.value && pendingApplyDraft.value.variableSetDraft.items.length === 0) {
    void structureVariableSetDraft({ rawContent: pendingApplyRawContent.value, automatic: true })
  }
}

const rebuildApplyDraft = async () => {
  const feedback = applyReviewFeedback.value.trim()
    || '当前结果不够像正式版本规则。请重新整理：只输出完整 ruleText 和 variableSetDraft，不要输出聊天总结、下一步建议或口语化说明。'
  applyPreviewDialogVisible.value = false
  await runApplyDraftCompilation(feedback)
}

const cancelApplyReview = () => {
  applyPreviewDialogVisible.value = false
}

const clearChatMessages = async () => {
  chatAbortController?.abort()
  chatMessages.value = []
  chatInput.value = ''
  chatStreaming.value = false
  await saveActiveChatSession()
}

const openV2ImportDialog = async () => {
  v2ImportDialogVisible.value = true
  v2SessionsLoading.value = true
  try {
    v2Sessions.value = await getGeoPromptEngineV2VersionDraftSessions()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'V2 会话加载失败')
  } finally {
    v2SessionsLoading.value = false
  }
}

const importV2Session = async (sourceSessionId: number) => {
  v2ImportingId.value = sourceSessionId
  try {
    const session = await importGeoV3VersionDraftSessionFromV2({ sourceSessionId })
    chatSessions.value = [session, ...chatSessions.value.filter((item) => item.id !== session.id)]
    selectChatSession(session)
    v2ImportDialogVisible.value = false
    ElMessage.success('V2 会话已复制到 V3')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入 V2 会话失败')
  } finally {
    v2ImportingId.value = null
  }
}

const formatDate = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false })

onMounted(() => {
  void loadFixedRules()
  void loadVersions()
})

onBeforeUnmount(() => {
  stopBatchTxtPolling()
})
</script>

<style scoped>
.geo-v3-page {
  display: grid;
  gap: 14px;
}

.geo-v3-toolbar,
.geo-v3-form-head,
.geo-v3-list-item__top,
.geo-v3-section-head,
.geo-v3-variable-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.geo-v3-toolbar h3,
.geo-v3-form-head h3,
.geo-v3-section-head h4 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--brand-ink);
}

.geo-v3-toolbar p,
.geo-v3-form-head p,
.geo-v3-section-head p,
.geo-v3-list-item p,
.geo-v3-empty span {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--brand-muted);
}

.geo-v3-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.geo-v3-workbench {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.geo-v3-list,
.geo-v3-variable-items {
  display: grid;
  gap: 10px;
}

.geo-v3-list-tree-wrap,
.geo-v3-list-toolbar {
  display: grid;
  gap: 10px;
}

.geo-v3-list-toolbar {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: rgba(255, 250, 249, 0.8);
}

.geo-v3-list-toolbar strong {
  display: block;
  color: var(--brand-ink);
  font-size: 13px;
}

.geo-v3-list-toolbar span {
  color: var(--brand-muted);
  font-size: 12px;
}

.geo-v3-list-batch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 9px 10px;
  border: 1px solid rgba(217, 107, 114, 0.16);
  border-radius: 8px;
  background: #fffafa;
}

.geo-v3-list-batch > span {
  margin-right: auto;
  color: var(--brand-muted);
  font-size: 12px;
}

.geo-v3-list-batch__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.geo-v3-list-batch__actions :deep(.el-button) {
  width: 100%;
  margin-left: 0;
}

.geo-v3-folder-tree {
  display: grid;
  gap: 16px;
}

.geo-v3-folder-tree--compact {
  gap: 12px;
}

.geo-v3-folder {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(217, 107, 114, 0.13);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 247, 246, 0.9), rgba(255, 252, 251, 0.7));
}

.geo-v3-folder__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(217, 107, 114, 0.22);
  border-radius: 10px;
  background: #fff1f1;
  box-shadow: inset 4px 0 0 rgba(217, 107, 114, 0.56);
}

.geo-v3-folder-toggle {
  width: 100%;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.geo-v3-folder-toggle:hover {
  filter: saturate(1.02);
}

.geo-v3-folder-toggle__label {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.geo-v3-folder-toggle__label .el-icon {
  flex: 0 0 auto;
  color: var(--brand-primary-strong);
  transition: transform 0.16s ease;
  transform: rotate(90deg);
}

.geo-v3-folder-toggle.collapsed .el-icon {
  transform: rotate(0deg);
}

.geo-v3-folder__head strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4d393e;
  font-size: 15px;
  font-weight: 800;
}

.geo-v3-folder__branch {
  display: grid;
  gap: 8px;
  margin-left: 8px;
  padding: 10px 0 0 12px;
  border-left: 3px solid rgba(217, 107, 114, 0.22);
}

.geo-v3-folder__branch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 8px;
  color: #735c63;
  background: rgba(255, 241, 241, 0.78);
  font-size: 13px;
}

button.geo-v3-folder__branch-head {
  border: 0;
}

.geo-v3-folder__branch-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
}

.geo-v3-folder__branch-head em {
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 999px;
  text-align: center;
  font-style: normal;
  color: #c95a62;
  background: #fffafa;
  border: 1px solid rgba(217, 107, 114, 0.16);
}

.geo-v3-variable-card,
.geo-v3-v2-import-item {
  width: 100%;
  padding: 12px;
  text-align: left;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 255, 255, 0.84);
}

.geo-v3-list-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  color: inherit;
  background: rgba(255, 255, 255, 0.84);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.geo-v3-list-item:hover,
.geo-v3-list-item.active {
  border-color: rgba(217, 107, 114, 0.34);
  background: #fff3f2;
  transform: translateY(-1px);
}

.geo-v3-list-item__check {
  padding: 13px 0 0 12px;
}

.geo-v3-list-item__content {
  min-width: 0;
  padding: 12px 12px 12px 0;
  border: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.geo-v3-list-item strong,
.geo-v3-variable-card strong,
.geo-v3-v2-import-item strong {
  color: #4d393e;
  font-size: 13px;
}

.geo-v3-list-item__content > span,
.geo-v3-v2-import-item span {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: #9a8186;
}

.geo-v3-empty {
  display: grid;
  gap: 6px;
  padding: 24px;
  text-align: center;
  border: 1px dashed rgba(217, 107, 114, 0.2);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-empty--inline {
  margin-top: 10px;
}

.geo-v3-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 160px;
  gap: 14px;
}

.geo-v3-form-grid > :deep(.el-form-item:only-child) {
  grid-column: 1 / -1;
}

.geo-v3-section-head {
  margin: 12px 0;
  padding-top: 14px;
  border-top: 1px solid rgba(217, 107, 114, 0.12);
}

.geo-v3-hidden-file {
  display: none;
}

.geo-v3-batch-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 14px;
  align-items: start;
}

.geo-v3-batch-panel,
.geo-v3-batch-result {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: rgba(255, 252, 251, 0.82);
}

.geo-v3-batch-form {
  margin-top: 14px;
}

.geo-v3-field-tip {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.geo-v3-batch-file-list,
.geo-v3-batch-requirements,
.geo-v3-batch-result-list {
  display: grid;
  gap: 10px;
}

.geo-v3-batch-file-list,
.geo-v3-batch-requirements {
  max-height: 330px;
  overflow: auto;
}

.geo-v3-batch-file-list article,
.geo-v3-batch-requirements article,
.geo-v3-batch-result-list article {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: #fffafa;
}

.geo-v3-batch-file-list article,
.geo-v3-batch-result-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.geo-v3-batch-file-list strong,
.geo-v3-batch-result-list strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #4d393e;
}

.geo-v3-batch-file-list p,
.geo-v3-batch-result-list p {
  margin: 5px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-v3-batch-requirements-textarea :deep(.el-textarea__inner) {
  min-height: 420px;
  line-height: 1.65;
}

.geo-v3-batch-result {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.geo-v3-batch-result-list {
  max-height: 260px;
  overflow: auto;
}

.geo-v3-variable-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.geo-v3-variable-grid--range {
  grid-template-columns: 180px minmax(0, 1fr);
}

.geo-v3-variable-card :deep(.el-form-item) {
  display: block;
  margin-bottom: 12px;
}

.geo-v3-variable-card :deep(.el-form-item__label) {
  display: block;
  margin-bottom: 6px;
  padding: 0;
  line-height: 1.2;
  text-align: left;
}

.geo-v3-variable-card :deep(.el-form-item__content) {
  display: block;
  min-width: 0;
}

.geo-count-stepper {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  gap: 6px;
  width: 100%;
}

.geo-count-stepper button {
  display: grid;
  place-items: center;
  height: 32px;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 8px;
  color: var(--brand-primary-strong);
  background: #fff7f6;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.geo-count-stepper button:hover:not(:disabled) {
  border-color: rgba(217, 107, 114, 0.34);
  background: #fff0ef;
}

.geo-count-stepper button:disabled {
  color: #cdb9bd;
  cursor: not-allowed;
  background: #fbf6f5;
  opacity: 0.72;
}

.geo-count-stepper input {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  text-align: center;
  border: 1px solid rgba(217, 107, 114, 0.18);
  border-radius: 8px;
  color: #4d393e;
  background: rgba(255, 252, 251, 0.96);
  outline: none;
}

.geo-count-stepper input:focus {
  border-color: rgba(217, 107, 114, 0.42);
  box-shadow: 0 0 0 2px rgba(217, 107, 114, 0.08);
}

.geo-count-stepper input:disabled {
  color: #9f8a8f;
  background: #fbf6f5;
}

.geo-count-stepper input::-webkit-outer-spin-button,
.geo-count-stepper input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}

.geo-v3-chat-layout {
  display: grid;
  grid-template-columns: 250px minmax(260px, 320px) minmax(0, 1fr);
  gap: 14px;
}

.geo-v3-chat-sessions,
.geo-v3-chat-context,
.geo-v3-chat-panel {
  min-width: 0;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: rgba(255, 252, 251, 0.78);
}

.geo-v3-chat-sessions,
.geo-v3-chat-context {
  padding: 14px;
}

.geo-v3-chat-session-actions,
.geo-v3-chat-context-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.geo-v3-chat-session-list,
.geo-v3-v2-import-list {
  display: grid;
  gap: 10px;
  max-height: 54vh;
  overflow: auto;
}

.geo-v3-chat-session {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 10px;
  text-align: left;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  color: inherit;
  background: #fffafa;
  cursor: pointer;
}

.geo-v3-chat-session.active,
.geo-v3-chat-session:hover {
  border-color: rgba(217, 107, 114, 0.34);
  background: #fff1f1;
}

.geo-v3-chat-session strong {
  font-size: 13px;
  color: #4d393e;
}

.geo-v3-chat-session span,
.geo-v3-chat-session em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-style: normal;
  color: #9a8186;
}

.geo-v3-chat-session__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.geo-v3-chat-session__foot em {
  min-width: 0;
}

.geo-v3-chat-panel {
  display: grid;
  grid-template-rows: auto minmax(320px, 1fr) auto;
  max-height: 72vh;
  overflow: hidden;
}

.geo-v3-chat-title {
  padding: 0 0 10px;
}

.geo-v3-chat-panel .geo-v3-chat-title {
  padding: 14px 14px 10px;
}

.geo-v3-chat-title h4 {
  margin: 0 0 6px;
  font-size: 14px;
  color: var(--brand-ink);
}

.geo-v3-chat-title p {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--brand-muted);
}

.geo-v3-chat-messages {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 300px;
  padding: 0 14px 14px;
  overflow: auto;
}

.geo-v3-chat-message {
  display: grid;
  gap: 6px;
  max-width: 86%;
  padding: 10px 12px;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-chat-message--user {
  justify-self: end;
  background: #fff1f1;
}

.geo-v3-chat-message--assistant {
  justify-self: start;
  background: #ffffff;
}

.geo-v3-chat-message strong {
  font-size: 12px;
  color: #5a3c42;
}

.geo-v3-chat-message p {
  margin: 0;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
  color: #604b50;
}

.geo-v3-chat-composer {
  display: grid;
  gap: 10px;
  padding: 12px 14px 14px;
  border-top: 1px solid rgba(217, 107, 114, 0.12);
  background: rgba(255, 248, 247, 0.72);
}

.geo-v3-chat-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.geo-v3-v2-import-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.geo-v3-v2-import-item p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-v3-apply-progress {
  display: grid;
  gap: 18px;
}

.geo-v3-apply-progress p {
  margin: 0;
  font-size: 13px;
  color: var(--brand-muted);
}

.geo-v3-apply-review {
  display: grid;
  gap: 16px;
}

.geo-v3-apply-review__checks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.geo-v3-apply-review__checks article {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(217, 107, 114, 0.14);
  border-radius: 8px;
  background: #fffafa;
}

.geo-v3-apply-review__checks strong {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #4d393e;
}

.geo-v3-apply-review__checks p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--brand-muted);
}

.geo-v3-apply-review__content {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 14px;
  align-items: start;
}

.geo-v3-section-head--compact {
  margin-bottom: 10px;
}

.geo-v3-apply-variable-list {
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.geo-v3-apply-variable-list div {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid rgba(217, 107, 114, 0.12);
  border-radius: 8px;
  background: #fff8f7;
}

.geo-v3-apply-variable-list strong {
  font-size: 12px;
  color: #5a3c42;
}

.geo-v3-apply-variable-list span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--brand-muted);
}

.geo-v3-apply-feedback {
  margin-top: 14px;
}

@media (max-width: 1020px) {
  .geo-v3-chat-layout,
  .geo-v3-batch-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .geo-v3-chat-panel {
    grid-column: 1 / -1;
    max-height: none;
  }

  .geo-v3-apply-review__content,
  .geo-v3-apply-review__checks {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1180px) {
  .geo-v3-workbench {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .geo-v3-toolbar,
  .geo-v3-form-head,
  .geo-v3-section-head,
  .geo-v3-variable-card__head,
  .geo-v3-v2-import-item,
  .geo-v3-batch-file-list article,
  .geo-v3-batch-result-list article {
    display: grid;
  }

  .geo-v3-form-grid,
  .geo-v3-variable-grid,
  .geo-v3-variable-grid--range,
  .geo-v3-chat-layout,
  .geo-v3-batch-layout {
    grid-template-columns: 1fr;
  }

  .geo-v3-chat-message {
    max-width: 100%;
  }
}
</style>
