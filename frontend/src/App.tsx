import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PlaygroundPage } from "@/pages/PlaygroundPage";
import { TreeListPage } from "@/pages/TreeListPage";
import { TreeWorkspacePage } from "@/pages/TreeWorkspacePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaygroundPage />} />
        <Route path="/trees" element={<TreeListPage />} />
        <Route path="/trees/:treeId" element={<TreeWorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}
