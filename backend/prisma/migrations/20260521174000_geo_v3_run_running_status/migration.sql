ALTER TABLE `GeoPromptV3GenerationRun`
  MODIFY `status` ENUM('RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED') NOT NULL DEFAULT 'RUNNING';

UPDATE `GeoPromptV3GenerationRun`
SET
  `status` = 'FAILED',
  `failedCount` = `requestedCount`,
  `lastError` = '生成任务中断，未产生 Prompt 明细，请重新生成。',
  `completedAt` = COALESCE(`completedAt`, `updatedAt`)
WHERE
  `status` = 'COMPLETED'
  AND `successCount` = 0
  AND `failedCount` = 0
  AND `zipFileName` = ''
  AND `completedAt` IS NULL;
