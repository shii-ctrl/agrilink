import cabbageImage from "@/assets/prod-cabbage.jpg";
import rootVegetableImage from "@/assets/prod-root.jpg";
import tomatoImage from "@/assets/prod-tomato.jpg";

export function marketplaceImageFor(name: string) {
  switch (name.toLowerCase()) {
    case "tomato":
      return tomatoImage;
    case "cabbage":
      return cabbageImage;
    default:
      return rootVegetableImage;
  }
}
