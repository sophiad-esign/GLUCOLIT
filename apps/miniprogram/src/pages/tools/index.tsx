import { Button, Image, Input, Textarea, View } from "@tarojs/components";
import { useState } from "react";

import { BrandHeader } from "../../components/brand-header";
import { apiRequest, chooseCompressedImage, uploadImage } from "../../lib/api";

type FoodResult = {
  mealSummary: string;
  foods: { name: string; estimatedPortion: string }[];
  caloriesKcal: { min: number; max: number };
  carbsGrams: { min: number; max: number };
  proteinGrams: { min: number; max: number };
  fatGrams: { min: number; max: number };
  fiberGrams: { min: number; max: number };
  plateBalanceScore: number;
  glycemicLoad: string;
  actions: string[];
  uncertainties: string[];
};
type Metrics = {
  glucoseUnit: "mmol/L" | "mg/dL";
  fastingGlucose: number | null;
  glucose60: number | null;
  glucose120: number | null;
  glucose180: number | null;
  fastingInsulin: number | null;
  insulin120: number | null;
  hba1c: number | null;
};
type OgttResult = {
  metrics: Metrics;
  classification: string;
  riskLevel: string;
  reportMarkdown: string;
};
type ProductResult = {
  productName: string;
  summary: string;
  suitability: "often" | "sometimes" | "rarely" | "uncertain";
  addedSugar: string;
  refinedCarbs: string;
  protein: string;
  fiber: string;
  keyIngredients: string[];
  strengths: string[];
  concerns: string[];
  shoppingAdvice: string[];
  uncertainties: string[];
  privacy: string;
};
const emptyMetrics: Metrics = {
  glucoseUnit: "mmol/L",
  fastingGlucose: null,
  glucose60: null,
  glucose120: null,
  glucose180: null,
  fastingInsulin: null,
  insulin120: null,
  hba1c: null,
};
const numberValue = (value: string) =>
  value.trim() === "" ? null : Number(value);

export default function ToolsPage() {
  const [mode, setMode] = useState<"food" | "ogtt" | "label">("food");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [food, setFood] = useState<FoodResult>();
  const [foodPhoto, setFoodPhoto] = useState("");
  const [notes, setNotes] = useState("");
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [recognized, setRecognized] = useState(false);
  const [ogtt, setOgtt] = useState<OgttResult>();
  const [product, setProduct] = useState<ProductResult>();
  const [productPhoto, setProductPhoto] = useState("");

  const run = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "暂时无法完成，请重试。",
      );
    } finally {
      setBusy(false);
    }
  };

  const analyzeFood = () =>
    run(async () => {
      const file = await chooseCompressedImage();
      setFoodPhoto(file);
      setFood(undefined);
      const result = await uploadImage<FoodResult>("/ai/food-upload", file, {
        consent: "true",
        mealType: "unknown",
        goal: "glucose",
        notes,
      });
      setFood(result);
    });

  const recognizeOgtt = () =>
    run(async () => {
      const file = await chooseCompressedImage();
      const result = await uploadImage<OgttResult>("/ai/ogtt-upload", file, {
        consent: "true",
        profile: "{}",
      });
      setMetrics(result.metrics);
      setRecognized(true);
      setOgtt(undefined);
    });

  const confirmOgtt = () =>
    run(async () => {
      const result = await apiRequest<OgttResult>("/ai/ogtt", {
        method: "POST",
        retry: false,
        data: { manualMetrics: metrics, profile: {}, consent: true },
      });
      setOgtt(result);
    });

  const analyzeProduct = () =>
    run(async () => {
      const file = await chooseCompressedImage();
      setProductPhoto(file);
      setProduct(undefined);
      const result = await uploadImage<ProductResult>(
        "/ai/product-upload",
        file,
        { consent: "true" },
      );
      setProduct(result);
    });

  const update = (key: keyof Metrics, value: string) =>
    setMetrics((current) => ({ ...current, [key]: numberValue(value) }));

  return (
    <View className="page">
      <BrandHeader />
      <View className="hero">
        <View className="eyebrow">AI 工具</View>
        <View className="hero-title">
          {mode === "food"
            ? "餐盘分析"
            : mode === "ogtt"
              ? "报告解读"
              : "配料表分析"}
        </View>
        <View className="hero-copy">
          {mode === "food"
            ? "看蔬菜、蛋白质和主食结构，给出下一餐可以直接执行的建议。"
            : mode === "ogtt"
              ? "读取 HbA1c、空腹血糖、餐后 2 小时血糖等指标，并提醒你确认数值。"
              : "识别添加糖、精制碳水、蛋白质和膳食纤维，辅助日常选购。"}
        </View>
      </View>
      <View className="row">
        <Button
          className={`button ${mode === "food" ? "secondary" : "ghost"}`}
          onClick={() => setMode("food")}
        >
          餐食分析
        </Button>
        <Button
          className={`button ${mode === "ogtt" ? "secondary" : "ghost"}`}
          onClick={() => setMode("ogtt")}
        >
          OGTT 解读
        </Button>
        <Button
          className={`button ${mode === "label" ? "secondary" : "ghost"}`}
          onClick={() => setMode("label")}
        >
          配料表
        </Button>
      </View>
      <View className="notice">
        上传前请遮挡姓名、身份证号、条码、手机号等个人信息。原始图片不保存。
      </View>
      {error && <View className="notice error">{error}</View>}

      {mode === "food" ? (
        <>
          <View className="card">
            <View className="card-title">拍摄完整餐盘</View>
            <View className="muted">
              尽量把主食、菜肴、饮料和酱汁放在同一画面；结果是范围估算，不是精确热量计算。
            </View>
            <Textarea
              className="textarea"
              maxlength={300}
              value={notes}
              onInput={(event) => setNotes(event.detail.value)}
              placeholder="可补充：这是早餐、外卖，或某道菜未拍到"
            />
            <Button
              loading={busy}
              disabled={busy}
              className="button"
              onClick={analyzeFood}
            >
              选择或拍摄餐食
            </Button>
            {foodPhoto && (
              <Image
                className="food-photo"
                src={foodPhoto}
                mode="aspectFill"
                showMenuByLongpress={false}
              />
            )}
          </View>
          {food && (
            <View className="card">
              <View className="card-title">这餐提示什么</View>
              <View>{food.mealSummary}</View>
              <View className="metric">
                {Math.round(food.plateBalanceScore)}/100
              </View>
              <View className="muted">
                餐盘平衡分 · 升糖负荷 {food.glycemicLoad}
              </View>
              <View className="card-title">热量与营养估算</View>
              <View>
                热量：{food.caloriesKcal.min}–{food.caloriesKcal.max} 千卡
              </View>
              <View>
                碳水：{food.carbsGrams.min}–{food.carbsGrams.max} 克
              </View>
              <View>
                蛋白质：{food.proteinGrams.min}–{food.proteinGrams.max} 克
              </View>
              <View>
                脂肪：{food.fatGrams.min}–{food.fatGrams.max} 克
              </View>
              <View>
                膳食纤维：{food.fiberGrams.min}–{food.fiberGrams.max} 克
              </View>
              <View className="muted">
                仅按照片可见份量估算；烹调油、酱汁和实际重量会明显影响结果。
              </View>
              <View className="card-title">识别到的食物</View>
              {food.foods.map((item) => (
                <View key={`${item.name}-${item.estimatedPortion}`}>
                  • {item.name}：{item.estimatedPortion}
                </View>
              ))}
              <View className="card-title">下一餐可以这样改</View>
              {food.actions.map((item, index) => (
                <View key={item}>
                  {index + 1}. {item}
                </View>
              ))}
              {!!food.uncertainties.length && (
                <View className="notice">
                  照片无法确定：{food.uncertainties.join("；")}
                </View>
              )}
            </View>
          )}
        </>
      ) : mode === "ogtt" ? (
        <>
          <View className="card">
            <View className="card-title">上传报告或直接手动录入</View>
            <Button
              loading={busy}
              disabled={busy}
              className="button"
              onClick={recognizeOgtt}
            >
              拍摄或选择报告
            </Button>
            <Button
              className="button ghost"
              onClick={() => {
                setRecognized(true);
                setMetrics(emptyMetrics);
                setOgtt(undefined);
              }}
            >
              识别不了，手动录入
            </Button>
          </View>
          {recognized && (
            <View className="card">
              <View className="card-title">请对照原报告逐项核对</View>
              <View className="notice">
                没有出现在报告中的项目请留空。核对后才会显示最终风险分层。
              </View>
              {(
                [
                  ["fastingGlucose", "空腹血糖"],
                  ["glucose60", "60分钟血糖"],
                  ["glucose120", "120分钟血糖"],
                  ["glucose180", "180分钟血糖"],
                  ["fastingInsulin", "空腹胰岛素"],
                  ["insulin120", "120分钟胰岛素"],
                  ["hba1c", "HbA1c %"],
                ] as [keyof Metrics, string][]
              ).map(([key, label]) => (
                <View key={key}>
                  <View className="label">{label}</View>
                  <Input
                    className="input"
                    type="digit"
                    value={metrics[key] == null ? "" : String(metrics[key])}
                    onInput={(event) => update(key, event.detail.value)}
                  />
                </View>
              ))}
              <Button
                loading={busy}
                disabled={busy}
                className="button secondary"
                onClick={confirmOgtt}
              >
                确认数值并分析
              </Button>
            </View>
          )}
          {ogtt && (
            <View className="card">
              <View className="card-title">分析结论</View>
              <View
                className={`notice ${ogtt.riskLevel === "normal" ? "success" : ""}`}
              >
                {ogtt.classification}
              </View>
              <View className="markdown">{ogtt.reportMarkdown}</View>
            </View>
          )}
        </>
      ) : (
        <>
          <View className="card">
            <View className="card-title">拍食品配料表</View>
            <View className="muted">
              请同时拍到配料表与营养成分表，并确保文字清晰、没有反光。
            </View>
            <Button
              loading={busy}
              disabled={busy}
              className="button"
              onClick={analyzeProduct}
            >
              拍照上传
            </Button>
            {productPhoto && (
              <Image
                className="food-photo"
                src={productPhoto}
                mode="aspectFill"
                showMenuByLongpress={false}
              />
            )}
          </View>
          {product && (
            <View className="card">
              <View className="eyebrow">配料表识别</View>
              <View className="card-title">{product.productName}</View>
              <View className="notice success">{product.summary}</View>
              <View className="mini-grid">
                <View className="mini-card">
                  <View>添加糖</View>
                  <View className="mini-value">{product.addedSugar}</View>
                </View>
                <View className="mini-card">
                  <View>精制碳水</View>
                  <View className="mini-value">{product.refinedCarbs}</View>
                </View>
                <View className="mini-card">
                  <View>购买频率</View>
                  <View className="mini-value">{product.suitability}</View>
                </View>
              </View>
              <View className="card-title">蛋白质与膳食纤维</View>
              <View>{product.protein}</View>
              <View>{product.fiber}</View>
              <View className="card-title">选购建议</View>
              {product.shoppingAdvice.map((item, index) => (
                <View className="action-step" key={item}>
                  {index + 1}. {item}
                </View>
              ))}
              {!!product.uncertainties.length && (
                <View className="notice">
                  看不清的部分：{product.uncertainties.join("；")}
                </View>
              )}
              <View className="muted">{product.privacy}</View>
            </View>
          )}
        </>
      )}
      <View className="notice">
        分析用于健康教育与就医准备，不构成诊断或个体化医疗治疗。
      </View>
    </View>
  );
}
