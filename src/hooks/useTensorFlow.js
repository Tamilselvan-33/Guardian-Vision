import { useState, useEffect } from "react";

// Global cache to persist model across hook remounts (prevents null model bug)
let persistentModel = null;

export function useTensorFlow() {
  const [model, setModel] = useState(persistentModel);
  const [isLoaded, setIsLoaded] = useState(!!persistentModel);

  useEffect(() => {
    // Dynamically load TFJS scripts to avoid heavy npm installs
    const loadScripts = async () => {
      // If already loaded in window and model exists in cache
      if (window.cocoSsd && persistentModel) {
        setIsLoaded(true);
        return;
      }

      // If scripts exist but model doesn't, just reload model
      if (window.cocoSsd && !persistentModel) {
        const loadedModel = await window.cocoSsd.load();
        persistentModel = loadedModel;
        setModel(loadedModel);
        setIsLoaded(true);
        return;
      }

      const tfScript = document.createElement("script");
      tfScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs";
      document.body.appendChild(tfScript);

      tfScript.onload = () => {
        const cocoScript = document.createElement("script");
        cocoScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
        document.body.appendChild(cocoScript);

        cocoScript.onload = async () => {
          const loadedModel = await window.cocoSsd.load();
          persistentModel = loadedModel;
          setModel(loadedModel);
          setIsLoaded(true);
        };
      };
    };

    loadScripts();
  }, []);

  return { model, isLoaded };
}
