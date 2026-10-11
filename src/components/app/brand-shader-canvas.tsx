import { useEffect, type CSSProperties } from "react";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

type Props = {
  onError?: () => void;
};

/**
 * Isolated WebGL canvas. Loaded only via React.lazy from BrandShaderHero.
 * Low pixelDensity + low-power preference for Telegram WebView.
 */
export function BrandShaderCanvas({ onError }: Props) {
  useEffect(() => {
    const onFail = () => onError?.();
    window.addEventListener("webglcontextlost", onFail);
    return () => window.removeEventListener("webglcontextlost", onFail);
  }, [onError]);

  const canvasStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  };

  try {
    return (
      <ShaderGradientCanvas
        style={canvasStyle}
        pixelDensity={1}
        fov={45}
        lazyLoad
        pointerEvents="none"
        powerPreference="low-power"
      >
        {/* Палитра приложения: графит, фирменный красный, бирюза (прототип FitSync) */}
        <ShaderGradient
          control="props"
          animate="on"
          type="waterPlane"
          uSpeed={0.15}
          uStrength={1.4}
          uDensity={1.1}
          uFrequency={4.2}
          color1="#d62e26"
          color2="#2a2e36"
          color3="#15171b"
          cDistance={4.2}
          cPolarAngle={110}
          cAzimuthAngle={180}
          lightType="3d"
          brightness={1.05}
          grain="off"
          reflection={0.05}
        />
      </ShaderGradientCanvas>
    );
  } catch {
    onError?.();
    return null;
  }
}
