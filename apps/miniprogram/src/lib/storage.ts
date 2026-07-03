import Taro from "@tarojs/taro";

const VERSION = "v1";
const key = (name: string) => `glucolit:${VERSION}:${name}`;

export const ensureDeviceId = () => {
  let value = Taro.getStorageSync<string>(key("device"));
  if (!value) {
    value = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    Taro.setStorageSync(key("device"), value);
  }
  return value;
};

export const readLocal = <T>(name: string, fallback: T): T => {
  try {
    return Taro.getStorageSync<T>(key(name)) || fallback;
  } catch {
    return fallback;
  }
};

export const writeLocal = <T>(name: string, value: T) =>
  Taro.setStorageSync(key(name), value);
