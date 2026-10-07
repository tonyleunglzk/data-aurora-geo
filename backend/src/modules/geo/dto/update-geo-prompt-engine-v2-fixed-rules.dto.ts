import { IsString } from 'class-validator'

export class UpdateGeoPromptEngineV2FixedRulesDto {
  @IsString()
  ruleText!: string
}
