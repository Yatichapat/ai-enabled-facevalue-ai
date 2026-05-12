import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, TrendingUp } from 'lucide-react';
import type { AnalyzeResponse } from '../lib/api';

function useInView(threshold = 0.1) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.unobserve(entry.target);
      }
    }, { threshold });

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [threshold]);

  return { ref, inView };
}

function AnimatedNumber({ value, suffix = '', decimals = 0, start = true }: { value: number, suffix?: string, decimals?: number, start?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!start) return;

    let startTime: number;
    const duration = 1500;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setDisplayValue(value * easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value, start]);

  return <>{displayValue.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

interface ResultViewProps {
  faceImageUrl: string;
  referenceImageUrl: string;
  analysisResult: AnalyzeResponse;
  onBack: () => void;
}

const FALLBACK_ANCHORS = [
  { region: 'forehead', x: 0.5, y: 0.14 },
  { region: 'eyes', x: 0.5, y: 0.28 },
  { region: 'nose', x: 0.5, y: 0.45 },
  { region: 'jawline', x: 0.28, y: 0.64 },
  { region: 'chin', x: 0.5, y: 0.8 },
];

export default function ResultView({ faceImageUrl, referenceImageUrl, analysisResult, onBack }: ResultViewProps) {
  const { ref: circleRef, inView: circleInView } = useInView(0.1);
  const { ref: metricsRef, inView: metricsInView } = useInView(0.1);
  const { ref: featuresRef, inView: featuresInView } = useInView(0.1);
  const { ref: packageRef, inView: packageInView } = useInView(0.1);
  const faceImageFrameRef = useRef<HTMLDivElement>(null);
  const [faceImageNaturalSize, setFaceImageNaturalSize] = useState({ width: 0, height: 0 });
  const [faceImageFrameSize, setFaceImageFrameSize] = useState({ width: 0, height: 0 });

  const faceRegionAnchors = analysisResult.face_region_anchors ?? FALLBACK_ANCHORS;
  const [animatedAnchors, setAnimatedAnchors] = useState(FALLBACK_ANCHORS);
  const displayedFaceImageUrl = analysisResult.analyzed_user_image ?? faceImageUrl;
  const displayedReferenceImageUrl = analysisResult.analyzed_reference_image ?? referenceImageUrl;

  const formatRegionLabel = (region: string) => region.charAt(0).toUpperCase() + region.slice(1);
  const getRegionDirection = (x: number) => (x >= 0.58 ? 'left' : 'right');
  const getMarkerPosition = (x: number, y: number) => {
    const { width: naturalWidth, height: naturalHeight } = faceImageNaturalSize;
    const { width: frameWidth, height: frameHeight } = faceImageFrameSize;

    if (!naturalWidth || !naturalHeight || !frameWidth || !frameHeight) {
      return { left: `${x * 100}%`, top: `${y * 100}%` };
    }

    const scale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const offsetX = (frameWidth - renderedWidth) / 2;
    const offsetY = (frameHeight - renderedHeight) / 2;

    return {
      left: `${offsetX + x * renderedWidth}px`,
      top: `${offsetY + y * renderedHeight}px`,
    };
  };
  const toReadableRegionName = (region: string) => region
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  useEffect(() => {
    const frame = faceImageFrameRef.current;

    if (!frame) {
      return;
    }

    const updateFrameSize = () => {
      const rect = frame.getBoundingClientRect();
      setFaceImageFrameSize({ width: rect.width, height: rect.height });
    };

    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      setAnimatedAnchors(faceRegionAnchors);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [faceRegionAnchors]);

  const features = analysisResult.region_differences
    ? Object.entries(analysisResult.region_differences)
        .map(([name, detail]) => ({
          name: toReadableRegionName(name),
          score: Math.max(0, Math.min(100, Math.round(100 - detail.average_difference))),
          averageDifference: detail.average_difference,
          landmarkCount: detail.landmark_count,
          shapeDifference: detail.shape_difference,
        }))
        .sort((a, b) => a.averageDifference - b.averageDifference)
    : analysisResult.deviation_by_region
      ? Object.entries(analysisResult.deviation_by_region).map(([name, diff]) => ({
          name: toReadableRegionName(name),
          score: Math.max(0, Math.min(100, Math.round(100 - diff))),
          averageDifference: diff,
          landmarkCount: undefined,
          shapeDifference: undefined,
        }))
      : [
          { name: 'Nose', score: 30, averageDifference: 70, landmarkCount: undefined, shapeDifference: undefined },
          { name: 'Eyes', score: 12, averageDifference: 88, landmarkCount: undefined, shapeDifference: undefined },
          { name: 'Jawline', score: 40, averageDifference: 60, landmarkCount: undefined, shapeDifference: undefined },
          { name: 'Forehead', score: 18, averageDifference: 82, landmarkCount: undefined, shapeDifference: undefined },
          { name: 'Chin', score: 60, averageDifference: 40, landmarkCount: undefined, shapeDifference: undefined },
        ];

  const overallScore = analysisResult.similarity_score !== undefined
    ? Math.round(analysisResult.similarity_score)
    : 85;

  const circumference = 2 * Math.PI * 45; // r=45
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-8">
      {/* Header */}
      <div className="w-full flex items-center justify-center relative mb-8">
        <button
          onClick={onBack}
          className="absolute left-0 p-2 border-[1.5px] border-[#c0862a] rounded-full text-[#c0862a] hover:bg-[#fdf3db] transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-4xl md:text-5xl font-serif text-[#1a1a1a]">Overall Analyzing</h1>
      </div>

      {/* Images and Circular Progress */}
      <div ref={circleRef} className="relative flex flex-col md:flex-row gap-4 md:gap-8 justify-center items-center w-full max-w-4xl">
        <div ref={faceImageFrameRef} className="w-full md:w-1/2 aspect-[4/5] rounded-xl overflow-hidden border-[3px] border-[#8c6b52] relative shadow-lg">
          <img
            key={displayedFaceImageUrl}
            src={displayedFaceImageUrl}
            alt="Your face"
            className="w-full h-full object-cover"
            onLoad={(event) => {
              setFaceImageNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />
          <div className="absolute inset-0 pointer-events-none">
            {animatedAnchors.map((region) => (
              <div
                key={region.region}
                className="absolute transition-all duration-700 ease-out"
                style={getMarkerPosition(region.x, region.y)}
              >
                <div className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.55)]" />
                <div
                  className={`absolute top-1/2 flex items-center gap-2 -translate-y-1/2 ${getRegionDirection(region.x) === 'left' ? 'right-4 flex-row-reverse' : 'left-4'}`}
                >
                  <div className="h-px w-10 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.35)]" />
                  <div className="rounded-full bg-black/55 px-3 py-1 backdrop-blur-sm shadow-lg">
                    <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-white">{formatRegionLabel(region.region)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        
        <div className="w-full md:w-1/2 aspect-[4/5] rounded-xl overflow-hidden border-[3px] border-[#dea0a0] relative shadow-lg">
          <img key={displayedReferenceImageUrl} src={displayedReferenceImageUrl} alt="Reference face" className="w-full h-full object-cover" />
        </div>
        

        {/* Center Circular Progress */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10">
          <div className="relative flex items-center justify-center">
            <svg className="w-40 h-40 md:w-56 md:h-56 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke="#fdf3db"
                strokeWidth="6"
                strokeOpacity="0.8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke="#c0862a"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={circleInView ? strokeDashoffset : circumference}
                strokeLinecap="round"
                className="transition-all duration-[1500ms] ease-out"
              />
            </svg>
            
            <div className="absolute w-28 h-28 md:w-36 md:h-36 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl md:text-5xl font-serif text-[#5f4635]"><AnimatedNumber value={overallScore} suffix="%" start={circleInView} /></span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Similarity Metrics Summary */}
      {(analysisResult.similarity_score !== undefined || analysisResult.average_difference !== undefined || analysisResult.mean_deviation !== undefined) && (
        <div ref={metricsRef} className="w-full max-w-4xl bg-gradient-to-r from-[#fdf3db] to-[#fae7e7] border-[2px] border-[#d4a574] rounded-xl p-6 shadow-md mb-8">
          <h2 className="text-2xl font-serif text-[#6f5543] mb-4 text-center">Similarity Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
            {analysisResult.similarity_score !== undefined && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-[#f5ead5]">
                <p className="text-xs text-[#8c6b52] mb-2">Overall Match</p>
                <p className="text-3xl font-bold text-[#c0862a]"><AnimatedNumber value={Math.round(analysisResult.similarity_score)} suffix="%" start={metricsInView} /></p>
              </div>
            )}
            {analysisResult.average_difference !== undefined && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-[#f5ead5]">
                <p className="text-xs text-[#8c6b52] mb-2">Avg Difference</p>
                <p className="text-2xl font-bold text-[#8f6d54]"><AnimatedNumber value={analysisResult.average_difference} decimals={1} suffix="%" start={metricsInView} /></p>
              </div>
            )}
            {analysisResult.mean_deviation !== undefined && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-[#f5ead5]">
                <p className="text-xs text-[#8c6b52] mb-2">Mean Deviation</p>
                <p className="text-2xl font-bold text-[#8f6d54]"><AnimatedNumber value={analysisResult.mean_deviation} decimals={1} suffix="%" start={metricsInView} /></p>
              </div>
            )}
            {analysisResult.alignment && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-[#f5ead5]">
                <p className="text-xs text-[#8c6b52] mb-2">Alignment</p>
                <p className="text-xl font-bold text-[#5f4635]">{analysisResult.alignment}</p>
              </div>
            )}
            {analysisResult.quality && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-[#f5ead5]">
                <p className="text-xs text-[#8c6b52] mb-2">Quality</p>
                <p className="text-xl font-bold text-[#5f4635]">{analysisResult.quality}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Morphed Preview */}
      {/* {analysisResult.morphed_image && (
        <div className="w-full max-w-2xl bg-[#fff7ef] border-[2px] border-[#e7d9c8] rounded-xl p-6 shadow-sm text-center">
          <h2 className="text-xl font-serif text-[#6f5543] mb-4">Morphed Preview</h2>
          <img
            src={`data:image/png;base64,${analysisResult.morphed_image}`}
            alt="Morphed result"
            className="w-full rounded-lg border border-[#ead9c8] shadow-md"
          />
        </div>
      )} */}

      {/* Feature Progress Bars */}
      <div ref={featuresRef} className="w-full max-w-4xl bg-[#fdf3db] border-[2px] border-[#e7d9c8] rounded-xl p-6 md:p-8 shadow-sm">
        <h2 className="text-2xl font-serif text-[#6f5543] mb-6">Facial Features Similarity</h2>
        <div className="flex flex-col gap-4 w-full">
          {features.map((feature) => (
            <button key={feature.name} className="w-full bg-white rounded-lg p-4 md:px-6 flex items-center shadow-sm border border-[#f5ead5] hover:shadow-lg transition-shadow duration-300 ease-in-out text-left cursor-pointer">
              <span className="w-28 md:w-40 font-serif text-[#8f6d54] text-xl md:text-2xl font-medium text-left block">{feature.name}</span>
              
              <div className="flex-1 mx-4 mt-5">
                <div className="h-3 md:h-4 w-full bg-[#e2d5d5] rounded-full overflow-hidden relative">
                  <div 
                    className="absolute right-0 top-0 h-full bg-[#e9a13b] rounded-full transition-all duration-[1500ms] ease-out"
                    style={{ width: featuresInView ? `${feature.score}%` : '0%' }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#8c6b52] justify-start">
                  <span>Avg diff: {feature.averageDifference.toFixed(1)}%</span>
                  {feature.shapeDifference !== undefined && <span>Shape diff: {feature.shapeDifference.toFixed(1)}%</span>}
                  {feature.landmarkCount !== undefined && <span>Points: {feature.landmarkCount}</span>}
                </div>
              </div>
              
              <span className="w-16 text-right font-serif text-[#8f6d54] text-lg md:text-xl font-medium">
                <AnimatedNumber value={feature.score} suffix="%" start={featuresInView} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Procedures and Recommendations */}
      {analysisResult.procedures && analysisResult.procedures.length > 0 && (
        <div className="w-full max-w-4xl bg-[#fae7e7] border-[2px] border-[#e7d9c8] rounded-xl p-6 md:p-8 shadow-sm">
          <h2 className="text-xl font-serif text-[#6f5543] mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Recommended Procedures
          </h2>
          <div className="flex flex-col gap-3">
            {analysisResult.procedures.map((proc, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-[#f5ead5] shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-serif text-[#8f6d54] text-lg font-semibold">{proc.procedure}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    proc.priority === 'high' ? 'bg-red-100 text-red-700' :
                    proc.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {typeof proc.priority === 'string' ? proc.priority.toUpperCase() : 'NORMAL'}
                  </span>
                </div>
                <p className="text-sm text-[#8c6b52] mb-2">{proc.reason}</p>
                {proc.estimated_cost_thb && (
                  <p className="text-sm font-medium text-[#6f5543]">
                    ฿{proc.estimated_cost_thb.toLocaleString('th-TH')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Package Summary */}
      {analysisResult.package_summary && (
        <div ref={packageRef} className="w-full max-w-4xl bg-gradient-to-r from-[#fdf3db] to-[#fae7e7] border-[2px] border-[#d4a574] rounded-xl p-6 md:p-8 shadow-md">
          <h2 className="text-2xl font-serif text-[#6f5543] mb-4 text-center">Package Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-center">
            {analysisResult.package_summary.procedure_count && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-[#8c6b52] mb-2">Total Procedures</p>
                <p className="text-3xl font-bold text-[#5f4635]">
                  <AnimatedNumber value={analysisResult.package_summary.procedure_count} start={packageInView} />
                </p>
              </div>
            )}
            {analysisResult.package_summary.total_estimated_cost_thb && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-[#8c6b52] mb-2">Estimated Cost</p>
                <p className="text-2xl font-bold text-[#c0862a]">
                  ฿<AnimatedNumber value={analysisResult.package_summary.total_estimated_cost_thb} start={packageInView} />
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
