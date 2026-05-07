import { TableContainer, TableHead, TableCell, TableRow } from "@mui/material";
import { styled } from "@mui/material/styles";

export const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  marginTop: theme.spacing(2),
  maxWidth: "100%",
  marginLeft: "auto",
  marginRight: "auto",
  overflowX: "auto",
}));

export const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.primary.light,
}));

export const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: "bold",
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1),
}));

export const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(odd)": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:nth-of-type(even)": {
    backgroundColor: theme.palette.background.default,
  },
  // Hover overlay — stacks on top of any background-color (normal, duplicate, selected)
  // without replacing it. backgroundImage renders above backgroundColor in CSS.
  "&:hover > td, &:hover > th": {
    backgroundImage: "linear-gradient(rgba(0,0,0,0.07), rgba(0,0,0,0.07))",
    cursor: "default",
  },
}));
