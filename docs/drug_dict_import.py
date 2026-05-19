#!/usr/bin/env python3
"""生成药品字典导入SQL脚本"""
import pandas as pd
import sys

EXCEL_PATH = "docs/K_DRUG_DICT药品字典.xlsx"
SQL_PATH = "docs/drug_dict_import.sql"
BATCH_SIZE = 500

def main():
    df = pd.read_excel(EXCEL_PATH)
    total = len(df)
    print(f"读取到 {total} 条药品记录")

    lines = [
        "-- 药品字典导入脚本",
        "-- Generated from: docs/K_DRUG_DICT药品字典.xlsx",
        "",
        "-- 1. Ensure DRUG dictionary exists",
        "INSERT INTO dictionary (code, name, description, status, created_at, updated_at)",
        "VALUES ('DRUG', '药品字典', '国家卫计委药品目录', 'ENABLED', NOW(), NOW())",
        "ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = NOW(), status = 'ENABLED';",
        "",
        "-- 2. Clean old items",
        "DELETE FROM dictionary_item WHERE dict_code = 'DRUG';",
        "",
    ]

    for batch_start in range(0, total, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total)
        lines.append(f"-- Batch {(batch_start // BATCH_SIZE) + 1} ({batch_start + 1}-{batch_end})")
        lines.append("INSERT INTO dictionary_item (dict_code, dict_id, item_code, item_name, item_value, sort_order, status, created_at) VALUES")

        values = []
        for i in range(batch_start, batch_end):
            row = df.iloc[i]
            code = str(row['CODE']) if pd.notna(row['CODE']) else ''
            name = str(row['NAME']) if pd.notna(row['NAME']) else ''
            sort_no = int(row['SORT_NO']) if pd.notna(row['SORT_NO']) else 0

            # 转义单引号
            name = name.replace("'", "''")
            code = code.replace("'", "''")

            values.append(f"    ('DRUG', (SELECT id FROM dictionary WHERE code = 'DRUG'), '{code}', '{name}', '{code}', {sort_no}, 'ENABLED', NOW())")

        lines.append(",\n".join(values) + ";")
        lines.append("")

    with open(SQL_PATH, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))

    print(f"已生成 SQL: {SQL_PATH} ({total} 条记录, {len(lines)} 行)")

if __name__ == '__main__':
    main()
