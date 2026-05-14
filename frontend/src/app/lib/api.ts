type RegionDetail = {
  average_difference: number;
  trimmed_landmark_difference?: number;
  raw_landmark_difference?: number;
  median_landmark_difference?: number;
  max_difference?: number;
  shape_difference?: number;
  landmark_count?: number;
};

export type AnalyzeResponse = {
  similarity_score?: number;
  average_difference?: number;
  mean_deviation?: number;
  alignment?: string;
  quality?: string;
  deviation_by_region?: Record<string, number>;
  region_differences?: Record<string, RegionDetail>;
  face_region_anchors?: Array<{
    region: string;
    x: number;
    y: number;
  }>;
  procedures?: Array<{
    procedure: string;
    reason: string;
    priority: string;
    estimated_cost_thb?: number;
  }>;
  package_summary?: {
    total_estimated_cost_thb?: number;
    procedure_count?: number;
  };
  analyzed_user_image?: string;
  analyzed_reference_image?: string;
  morphed_image?: string;
};

function getBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}

export async function analyzeFaces(userImage: File, referenceImage: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("user_image", userImage);
  formData.append("reference_image", referenceImage);

  let response: Response;

  try {
    response = await fetch(`${getBackendBaseUrl()}/analysis/analyze`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("Unable to reach the analysis service. Please check that the backend is running and try again.");
  }

  if (!response.ok) {
    let detail = "Analysis request failed";

    try {
      const errorData = await response.json();
      if (typeof errorData?.detail === "string") {
        detail = errorData.detail;
      }
    } catch {
      // Keep generic fallback when backend does not return JSON.
    }

    throw new Error(toUserFacingApiError(detail, response.status));
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error("The analysis service returned an unreadable response. Please try again.");
  }
  
  // Sanitize the response to remove non-serializable objects
  const result = sanitizeAnalysisResponse(data);

  if (!hasPredictionResult(result)) {
    throw new Error("The analysis completed, but no prediction result was returned. Please try another image pair.");
  }

  return result;
}

function toUserFacingApiError(detail: string, status: number): string {
  const normalizedDetail = detail.toLowerCase();
  const photoLabel = getPhotoLabel(normalizedDetail);
  const prefix = photoLabel ? `${photoLabel} has an issue: ` : "";
  const backendReason = detail
    .replace(/^(user|reference) image rejected:\s*/i, "")
    .trim();

  if (status === 400 || normalizedDetail.includes("invalid image format")) {
    return `${prefix}Unsupported or invalid image file. Please upload a clear PNG or JPG image.`;
  }

  if (
    status === 422 ||
    normalizedDetail.includes("could not detect face") ||
    normalizedDetail.includes("no face detected")
  ) {
    return `${prefix}No face was detected clearly enough. Please upload a front-facing photo with good lighting.`;
  }

  return photoLabel && backendReason
    ? `${prefix}${backendReason}`
    : detail || "Analysis request failed. Please try again.";
}

function getPhotoLabel(normalizedDetail: string): string | null {
  if (normalizedDetail.includes("user image")) {
    return "Your photo";
  }

  if (normalizedDetail.includes("reference image")) {
    return "Reference photo";
  }

  return null;
}

function hasPredictionResult(result: AnalyzeResponse): boolean {
  return (
    typeof result.similarity_score === 'number' ||
    Boolean(result.region_differences && Object.keys(result.region_differences).length > 0) ||
    Boolean(result.deviation_by_region && Object.keys(result.deviation_by_region).length > 0) ||
    Boolean(result.procedures && result.procedures.length > 0)
  );
}

function sanitizeAnalysisResponse(data: unknown): AnalyzeResponse {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const obj = data as Record<string, unknown>;

  return {
    similarity_score: typeof obj.similarity_score === 'number' ? obj.similarity_score : undefined,
    average_difference: typeof obj.average_difference === 'number' ? obj.average_difference : undefined,
    mean_deviation: typeof obj.mean_deviation === 'number' ? obj.mean_deviation : undefined,
    alignment: typeof obj.alignment === 'string' ? obj.alignment : undefined,
    quality: typeof obj.quality === 'string' ? obj.quality : undefined,
    deviation_by_region: isSerializableRecord(obj.deviation_by_region) ? obj.deviation_by_region as Record<string, number> : undefined,
    region_differences: sanitizeRegionDetails(obj.region_differences),
    face_region_anchors: sanitizeFaceRegionAnchors(obj.face_region_anchors),
    procedures: Array.isArray(obj.procedures) ? (obj.procedures as Array<unknown>).filter(p => {
      return p && typeof p === 'object' && 'procedure' in p && 'reason' in p;
    }).map(p => ({
      procedure: String((p as Record<string, unknown>).procedure || ''),
      reason: String((p as Record<string, unknown>).reason || ''),
      priority: String((p as Record<string, unknown>).priority || 'normal'),
      estimated_cost_thb: typeof (p as Record<string, unknown>).estimated_cost_thb === 'number' ? (p as Record<string, unknown>).estimated_cost_thb as number : undefined,
    })) : undefined,
    package_summary: isSerializablePackageSummary(obj.package_summary) ? {
      total_estimated_cost_thb: typeof (obj.package_summary as Record<string, unknown>).total_estimated_cost_thb === 'number' ? (obj.package_summary as Record<string, unknown>).total_estimated_cost_thb as number : undefined,
      procedure_count: typeof (obj.package_summary as Record<string, unknown>).procedure_count === 'number' ? (obj.package_summary as Record<string, unknown>).procedure_count as number : undefined,
    } : undefined,
    analyzed_user_image: toPngDataUrl(obj.analyzed_user_image),
    analyzed_reference_image: toPngDataUrl(obj.analyzed_reference_image),
    morphed_image: typeof obj.morphed_image === 'string' ? obj.morphed_image : undefined,
  };
}

function toPngDataUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value.startsWith('data:image/')
    ? value
    : `data:image/png;base64,${value}`;
}

function isSerializableRecord(obj: unknown): obj is Record<string, number> {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  return Object.values(record).every(v => typeof v === 'number');
}

function isSerializablePackageSummary(obj: unknown): obj is Record<string, number> {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  return Object.values(record).every(v => typeof v === 'number' || typeof v === 'undefined');
}

function sanitizeFaceRegionAnchors(value: unknown): AnalyzeResponse['face_region_anchors'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((anchor): anchor is Record<string, unknown> => {
      return Boolean(anchor) && typeof anchor === 'object';
    })
    .map((anchor) => ({
      region: typeof anchor.region === 'string' ? anchor.region : '',
      x: typeof anchor.x === 'number' ? anchor.x : 0,
      y: typeof anchor.y === 'number' ? anchor.y : 0,
    }))
    .filter((anchor) => anchor.region.length > 0);
}

function sanitizeRegionDetails(value: unknown): AnalyzeResponse['region_differences'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const details = value as Record<string, unknown>;
  const cleaned = Object.entries(details).reduce<Record<string, RegionDetail>>((acc, [region, raw]) => {
    if (!raw || typeof raw !== 'object') {
      return acc;
    }

    const row = raw as Record<string, unknown>;
    const average = row.average_difference;

    if (typeof average !== 'number') {
      return acc;
    }

    acc[region] = {
      average_difference: average,
      trimmed_landmark_difference: typeof row.trimmed_landmark_difference === 'number' ? row.trimmed_landmark_difference : undefined,
      raw_landmark_difference: typeof row.raw_landmark_difference === 'number' ? row.raw_landmark_difference : undefined,
      median_landmark_difference: typeof row.median_landmark_difference === 'number' ? row.median_landmark_difference : undefined,
      max_difference: typeof row.max_difference === 'number' ? row.max_difference : undefined,
      shape_difference: typeof row.shape_difference === 'number' ? row.shape_difference : undefined,
      landmark_count: typeof row.landmark_count === 'number' ? row.landmark_count : undefined,
    };

    return acc;
  }, {});

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}
