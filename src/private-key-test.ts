import { projectName, projects } from "./lib/environments/firebase";

const keyRipple = "";
export const getPrivateKeyPemTest: any = (name = projectName) => {
  switch (name) {
    case projects.ripple:
      return keyRipple;
    default:
      return "";
  }
};