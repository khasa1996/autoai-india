"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  interactionManifestSchema,
  type InteractionManifest,
  type SavedConfiguration,
} from "../../../packages/configurator/src/index";
import type {
  VehicleViewer,
  CameraPreset,
} from "../../../packages/three-engine/src/index";

export function Studio() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<VehicleViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manifest, setManifest] = useState<InteractionManifest | null>(null);
  const [configuration, setConfiguration] = useState<SavedConfiguration | null>(
    null,
  );
  useEffect(() => {
    let disposed = false;
    import("../../../packages/three-engine/src/index")
      .then(async ({ VehicleViewer }) => {
        if (disposed || !canvas.current) return;
        try {
          viewer.current = new VehicleViewer(canvas.current);
          setReady(true);
          const [assetResponse, manifestResponse] = await Promise.all([
            fetch("/models/original-concept.glb"),
            fetch("/models/original-concept.manifest.json"),
          ]);
          if (!assetResponse.ok || !manifestResponse.ok)
            throw new Error("The bundled concept asset is unavailable.");
          const parsed = interactionManifestSchema.parse(
            await manifestResponse.json(),
          );
          const file = new File(
            [await assetResponse.blob()],
            "original-concept.glb",
            { type: "model/gltf-binary" },
          );
          if (disposed || !viewer.current) return;
          await viewer.current.loadLocalFile(file, parsed);
          setManifest(parsed);
          setConfiguration(viewer.current.save());
        } catch (error) {
          setError(
            error instanceof Error
              ? `The original 3D concept could not be loaded: ${error.message}`
              : "The original 3D concept could not be loaded. Enable WebGL or open an approved local GLB below.",
          );
        }
      })
      .catch(() => {
        if (!disposed)
          setError("The 3D viewer could not be loaded. Reload to retry.");
      });
    return () => {
      disposed = true;
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, []);
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      const glb = data.get("asset") as File,
        json = data.get("manifest") as File;
      if (!glb?.size || !json?.size)
        throw new Error("Select both a GLB and its interaction manifest.");
      if (json.size > 1024 * 1024)
        throw new Error("Manifest must be smaller than 1 MiB.");
      const parsed = interactionManifestSchema.parse(
        JSON.parse(await json.text()),
      );
      if (!viewer.current) throw new Error("Viewer is not ready.");
      await viewer.current.loadLocalFile(glb, parsed);
      setManifest(parsed);
      setConfiguration(viewer.current.save());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load asset.");
    } finally {
      setBusy(false);
    }
  }
  function change(action: (v: VehicleViewer) => void) {
    try {
      if (viewer.current) {
        action(viewer.current);
        setConfiguration(viewer.current.save());
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Configuration is invalid.");
    }
  }
  function download() {
    if (!viewer.current || !manifest) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(viewer.current.save(), null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vehicle-configuration.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">YOUR PERSONAL SHOWROOM</span>
        <h1>Every angle. Your perspective.</h1>
        <p className="lead">
          Inspect an original, unbranded concept model, explore its materials
          and save a configuration locally.
        </p>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <section
        className="panel"
        aria-label="3D vehicle viewport"
        style={{
          position: "relative",
          overflow: "hidden",
          padding: 0,
          background: "#11151d",
        }}
      >
        <canvas
          ref={canvas}
          aria-label={
            manifest
              ? `Interactive model: ${manifest.assetId}. Use pointer to orbit and scroll to zoom; camera controls follow.`
              : "Empty 3D viewport"
          }
          style={{
            display: "block",
            width: "100%",
            height: "min(58vh, 560px)",
            minHeight: 300,
          }}
        />
        {!manifest && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeContent: "center",
              textAlign: "center",
              padding: "2rem",
              color: "#edf0f7",
              pointerEvents: "none",
            }}
          >
            <span className="eyebrow">A SPACE FOR YOUR NEXT DRIVE</span>
            <h2>Preparing the original concept.</h2>
            <p>The bundled unbranded GLB is verified before display.</p>
          </div>
        )}
      </section>
      <section className="panel">
        <h2 className="section-title">Open a local model</h2>
        <p>
          Files stay in your browser. The viewer verifies the GLB hash, embedded
          resources, paint targets and articulation limits against your
          manifest. A manifest declares licensing; verify those rights before
          use.
        </p>
        <form onSubmit={load} className="form-grid">
          <label className="field">
            Vehicle GLB · up to 50 MiB
            <input
              name="asset"
              type="file"
              accept=".glb"
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            Interaction manifest · JSON
            <input
              name="manifest"
              type="file"
              accept=".json,application/json"
              required
              disabled={busy}
            />
          </label>
          <button className="button" disabled={!ready || busy}>
            {busy ? "Checking and loading…" : "Open model"}
          </button>
        </form>
      </section>
      {manifest && configuration && (
        <>
          <section className="panel">
            <h2 className="section-title">Explore {manifest.assetId}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(
                [
                  "threeQuarter",
                  "front",
                  "rear",
                  "left",
                  "right",
                  "top",
                ] as CameraPreset[]
              ).map((preset) => (
                <button
                  type="button"
                  className="button secondary"
                  key={preset}
                  disabled={busy}
                  onClick={() => viewer.current?.setCamera(preset)}
                >
                  {preset === "threeQuarter"
                    ? "Three-quarter"
                    : preset[0].toUpperCase() + preset.slice(1)}
                </button>
              ))}
            </div>
            <div className="form-grid" style={{ marginTop: 24 }}>
              {manifest.paint.map((group) => (
                <label className="field" key={group.id}>
                  Paint · {group.id}
                  <input
                    type="color"
                    value={configuration.paint[group.id] ?? "#ffffff"}
                    disabled={busy}
                    onChange={(event) =>
                      change((v) => v.setPaint(group.id, event.target.value))
                    }
                  />
                  <span>
                    {configuration.paint[group.id] ??
                      "Original material (select a color to change)"}
                  </span>
                </label>
              ))}
              {manifest.articulations.map((part) => (
                <label className="field" key={part.id}>
                  {part.id} ·{" "}
                  {(
                    configuration.articulations[part.id] ?? part.closedRadians
                  ).toFixed(2)}{" "}
                  radians
                  <input
                    type="range"
                    min={part.minRadians}
                    max={part.maxRadians}
                    step="0.001"
                    value={
                      configuration.articulations[part.id] ?? part.closedRadians
                    }
                    disabled={busy}
                    onChange={(event) =>
                      change((v) =>
                        v.setArticulation(part.id, Number(event.target.value)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            {!manifest.paint.length && !manifest.articulations.length && (
              <p className="notice">
                This manifest has no editable paint groups or articulated parts.
              </p>
            )}
          </section>
          <section className="panel">
            <h2 className="section-title">Keep your configuration</h2>
            <p>
              JSON stores paint and part positions for this exact asset
              revision. It does not export the model.
            </p>
            <button className="button" disabled={busy} onClick={download}>
              Download configuration
            </button>
            <label className="field" style={{ marginTop: 20 }}>
              Restore configuration
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 1024 * 1024)
                      throw new Error(
                        "Configuration must be smaller than 1 MiB.",
                      );
                    const input: unknown = JSON.parse(await file.text());
                    change((v) => v.restore(input));
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Unable to restore configuration.",
                    );
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </section>
          <section className="panel">
            <h2 className="section-title">Asset provenance</h2>
            <dl>
              <dt>License</dt>
              <dd>
                {manifest.license.name} · {manifest.license.permittedUse}
              </dd>
              <dt>Source declared by manifest</dt>
              <dd style={{ overflowWrap: "anywhere" }}>
                {manifest.license.source}
              </dd>
              <dt>Verified SHA-256</dt>
              <dd style={{ overflowWrap: "anywhere" }}>
                {manifest.assetSha256}
              </dd>
            </dl>
          </section>
        </>
      )}
    </>
  );
}

export default Studio;
