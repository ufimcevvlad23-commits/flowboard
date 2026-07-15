from __future__ import annotations

import json
from io import BytesIO, StringIO
from typing import Any

import pandas as pd


def build_export(payload: dict[str, Any], export_format: str) -> tuple[bytes, str, str]:
    project_id = payload["project"]["id"]
    if export_format == "json":
        data = json.dumps(payload, ensure_ascii=False, indent=2, default=str).encode("utf-8")
        return data, "application/json", f"project-{project_id}.json"
    if export_format == "csv":
        rows = []
        for record_type in ("project", "keywords", "outline", "articles", "scores"):
            records = payload.get(record_type, [])
            if isinstance(records, dict):
                records = [records]
            for record in records:
                rows.append({"record_type": record_type, "data": json.dumps(record, ensure_ascii=False, default=str)})
        output = StringIO()
        pd.DataFrame(rows).to_csv(output, index=False)
        return output.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", f"project-{project_id}.csv"
    if export_format == "xlsx":
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            for sheet, key in (("project", "project"), ("keywords", "keywords"), ("outline", "outline"), ("articles", "articles"), ("scores", "scores")):
                records = payload.get(key, [])
                if isinstance(records, dict):
                    records = [records]
                normalized = pd.json_normalize(records) if records else pd.DataFrame()
                normalized.to_excel(writer, sheet_name=sheet, index=False)
        return output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", f"project-{project_id}.xlsx"
    raise ValueError("Формат должен быть json, csv или xlsx.")
