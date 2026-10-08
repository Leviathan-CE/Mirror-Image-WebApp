-- Existing volumes: is_summon is the printed-TLV flag. Rename it to has_tlv
-- and drop the extra empty column if an earlier form of this file added one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'cards'
       AND column_name = 'is_summon'
  ) THEN
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'cards'
         AND column_name = 'has_tlv'
    ) THEN
      UPDATE cards SET has_tlv = is_summon;
      ALTER TABLE cards DROP COLUMN is_summon;
    ELSE
      ALTER TABLE cards RENAME COLUMN is_summon TO has_tlv;
    END IF;
  END IF;
END $$;
