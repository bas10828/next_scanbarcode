"use client";
import React from "react";
import {
  Alert,
  Box,
  Card,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { CATEGORIES, CATEGORY_LABEL, type CheckResult } from "./checks";
import type { SectionMode } from "./sections";

type Props = {
  checks: CheckResult;
  mode: SectionMode;
  onModeChange: (mode: SectionMode) => void;
  limitQty: boolean;
  onLimitQtyChange: (v: boolean) => void;
  customKeywords: Record<number, string>;
  onKeywordChange: (index: number, value: string) => void;
};

// est = quantity in the estimate, inv = devices found in the inventory.
const CountChip: React.FC<{ label: string; est: number; inv: number }> = ({ label, est, inv }) => {
  const color = inv === est ? "success" : inv < est ? "warning" : "info";
  return (
    <Chip
      size="small"
      color={color}
      variant={inv === est ? "outlined" : "filled"}
      label={`${label} ${inv}/${est}`}
      sx={{ fontSize: "0.72rem" }}
    />
  );
};

const CheckPanel: React.FC<Props> = ({ checks, mode, onModeChange, limitQty, onLimitQtyChange, customKeywords, onKeywordChange }) => (
  <Card variant="outlined" sx={{ p: 2.5, borderColor: "#c7d2fe", bgcolor: "#f8faff" }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
      <FactCheckIcon sx={{ color: "primary.main" }} />
      <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
        ตรวจสอบก่อน Generate
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={(_, v) => v && onModeChange(v)}
      >
        <ToggleButton value="header">จับตามชื่อหัวข้อ (แบบเดิม)</ToggleButton>
        <ToggleButton value="custom">กำหนด Location เอง</ToggleButton>
      </ToggleButtonGroup>
    </Box>

    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
      ตัวเลขคือ <b>Inventory / ประมาณงาน</b> — เขียว = ตรง, ส้ม = Inventory น้อยกว่า, ฟ้า = Inventory มากกว่า.
      ส่วนนี้แสดงในเว็บเท่านั้น ไม่ลงในรายงาน
      {mode === "custom" && " — ใส่คำที่อยู่ใน Location คั่นด้วย , (ปล่อยว่าง = ใช้ชื่อหัวข้อ)"}
    </Typography>

    <FormControlLabel
      sx={{ display: "flex", mb: 1 }}
      control={<Checkbox size="small" checked={limitQty} onChange={(e) => onLimitQtyChange(e.target.checked)} />}
      label="จำกัดจำนวนอุปกรณ์ตามประมาณงาน (ใช้เมื่อตึกเดียวถูกแบ่งหลายใบประมาณการ/หลายเล่ม — เอา N ตัวแรกตามชื่อ Device Name)"
    />

    <Stack spacing={1} sx={{ mb: 1.5 }}>
      {checks.inventoryError && <Alert severity="error">{checks.inventoryError}</Alert>}
      {checks.inventoryWarnings.map((w) => (
        <Alert key={w} severity="warning">
          {w}
        </Alert>
      ))}
    </Stack>

    <TableContainer component={Box} sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 1.5, bgcolor: "white" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "grey.100" }}>
            <TableCell sx={{ fontWeight: 700, width: "30%" }}>หัวข้อ</TableCell>
            {mode === "custom" && <TableCell sx={{ fontWeight: 700, width: "25%" }}>คำค้น Location</TableCell>}
            <TableCell sx={{ fontWeight: 700 }}>อุปกรณ์</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>ไม่ลงรายงาน</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {checks.sections.map((s) => (
            <TableRow key={s.index} sx={s.deviceCount === 0 ? { bgcolor: "#fffbeb" } : undefined}>
              <TableCell sx={{ fontSize: "0.82rem" }}>
                {s.no}. {s.name}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {s.deviceCount} เครื่อง
                </Typography>
              </TableCell>
              {mode === "custom" && (
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={s.name}
                    value={customKeywords[s.index] ?? ""}
                    onChange={(e) => onKeywordChange(s.index, e.target.value)}
                    slotProps={{ htmlInput: { style: { fontSize: "0.8rem" } } }}
                  />
                </TableCell>
              )}
              <TableCell>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {CATEGORIES.filter((c) => s.counts[c]).map((c) => (
                    <CountChip key={c} label={CATEGORY_LABEL[c]} est={s.counts[c]!.est} inv={s.counts[c]!.inv} />
                  ))}
                </Box>
              </TableCell>
              <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {s.skipped.map((k, i) => (
                  <div key={i}>
                    {k.detail.length > 50 ? `${k.detail.slice(0, 50)}…` : k.detail} {k.qty && `× ${k.qty}`}
                  </div>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    {checks.unmatched.length > 0 && (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        <b>อุปกรณ์ที่ไม่เข้าหัวข้อไหนเลย ({checks.unmatched.length})</b> — จะไม่อยู่ในรายงาน
        {checks.unmatched.map((d, i) => (
          <div key={i} style={{ fontSize: "0.8rem" }}>
            {d.name} · {d.type} · {d.location || "(ไม่มี Location)"}
          </div>
        ))}
      </Alert>
    )}
    {checks.multiMatched.length > 0 && (
      <Alert severity="warning" sx={{ mt: 1.5 }}>
        <b>อุปกรณ์ที่เข้าหลายหัวข้อ ({checks.multiMatched.length})</b> — จะซ้ำในรายงาน
        {checks.multiMatched.map((d, i) => (
          <div key={i} style={{ fontSize: "0.8rem" }}>
            {d.name} · {d.location} → หัวข้อ {d.sections.join(", ")}
          </div>
        ))}
      </Alert>
    )}
  </Card>
);

export default CheckPanel;
