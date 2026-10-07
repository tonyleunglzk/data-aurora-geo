UPDATE `VideoGenerationTemplate`
SET
  `name` = '角色口播',
  `description` = '适合虚拟主持、拟人品牌角色、轻松讲解类产品短视频。',
  `sortOrder` = 60,
  `promptTemplate` = '竖屏 {{duration}} 秒角色口播短视频，一位亲和的虚拟主持或品牌角色在干净真实的场景中面对镜头自然讲解。主题：{{topic}}。产品信息：品牌 {{brand}}，产品名 {{productName}}，品类 {{category}}，目标人群 {{targetAudience}}。必须体现：{{requiredContent}}。卖点：{{sellingPoints}}。强调点：{{emphasis}}。语气轻松可信，镜头稳定，字幕简洁，结尾给出一句自然的推荐。'
WHERE `key` = 'cat-talk';

UPDATE `VideoGenerationTemplate` SET `sortOrder` = 10 WHERE `key` = 'human-talk';
UPDATE `VideoGenerationTemplate` SET `sortOrder` = 20 WHERE `key` = 'product-showcase';
UPDATE `VideoGenerationTemplate` SET `sortOrder` = 30 WHERE `key` = 'seeding-recommendation';
UPDATE `VideoGenerationTemplate` SET `sortOrder` = 40 WHERE `key` = 'knowledge-explainer';
UPDATE `VideoGenerationTemplate` SET `sortOrder` = 50 WHERE `key` = 'comparison-review';
