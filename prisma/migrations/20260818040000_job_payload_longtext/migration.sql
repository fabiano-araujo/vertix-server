-- Expand AI job payloads so a full series script fits when approving production.
ALTER TABLE `AIGenerationJob` MODIFY `inputData` LONGTEXT NOT NULL;
ALTER TABLE `AIGenerationJob` MODIFY `outputData` LONGTEXT NULL;
