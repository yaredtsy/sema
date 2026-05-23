import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TreeListPage } from "@/pages/TreeListPage";
import { TreeWorkspacePage } from "@/pages/TreeWorkspacePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TreeListPage />} />
        <Route path="/trees/:treeId" element={<TreeWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
