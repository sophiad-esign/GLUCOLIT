import Taro from "@tarojs/taro";

import { ensureDeviceId } from "./storage";

export const API_BASE =
  process.env.TARO_APP_API_BASE_URL || "https://glucolit.vercel.app/api";

const messageOf = (value: unknown) => {
  if (value && typeof value === "object" && "error" in value) {
    return String(value.error);
  }
  return "服务暂时不可用，请稍后重试。";
};

export async function apiRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; data?: unknown; retry?: boolean } = {},
): Promise<T> {
  const request = async () => {
    const response = await Taro.request<T>({
      url: `${API_BASE}${path}`,
      method: options.method || "GET",
      data: options.data,
      timeout: 30000,
      header: {
        "content-type": "application/json",
        "x-client-platform": "mobile-miniprogram",
        "x-device-id": ensureDeviceId(),
        "x-request-id": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(messageOf(response.data));
    }
    return response.data;
  };

  try {
    return await request();
  } catch (error) {
    if ((options.method || "GET") === "GET" && options.retry !== false) {
      return request();
    }
    throw error;
  }
}

export async function uploadImage<T>(
  path: "/ai/food-upload" | "/ai/ogtt-upload",
  filePath: string,
  formData: Record<string, string>,
): Promise<T> {
  const response = await Taro.uploadFile({
    url: `${API_BASE}${path}`,
    filePath,
    name: "image",
    formData,
    timeout: 30000,
    header: {
      "x-client-platform": "mobile-miniprogram",
      "x-device-id": ensureDeviceId(),
    },
  });
  let data: unknown;
  try {
    data = JSON.parse(response.data);
  } catch {
    throw new Error("服务器返回了无法读取的内容。");
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(messageOf(data));
  }
  return data as T;
}

export const chooseCompressedImage = async () => {
  const selected = await Taro.chooseMedia({
    count: 1,
    mediaType: ["image"],
    sourceType: ["album", "camera"],
    sizeType: ["compressed"],
  });
  const file = selected.tempFiles[0];
  if (!file) throw new Error("没有选择图片。");
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("图片超过 5MB，请裁剪或压缩后重试。");
  }
  return file.tempFilePath;
};
