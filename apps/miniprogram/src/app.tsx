import { PropsWithChildren, useEffect } from "react";

import { ensureDeviceId } from "./lib/storage";
import "./app.scss";

export default function App({ children }: PropsWithChildren) {
  useEffect(() => {
    ensureDeviceId();
  }, []);
  return children;
}
