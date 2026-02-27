"use client";

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageGalleryProps = {
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
};

export function ImageGallery({ urls, initialIndex = 0, onClose }: ImageGalleryProps) {
  const [index, setIndex] = React.useState(initialIndex);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setIndex(Math.min(Math.max(0, initialIndex), urls.length - 1));
  }, [initialIndex, urls.length]);

  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(urls.length - 1, i + 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, urls.length]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === containerRef.current) onClose();
  }

  if (urls.length === 0) return null;

  const current = urls[index]!;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      <div className="flex shrink-0 items-center justify-end p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={onClose}
          aria-label="Close gallery"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-4">
        <div className="relative w-full max-w-4xl aspect-[4/3] max-h-[70vh]">
          <Image
            src={current}
            alt=""
            fill
            className="object-contain select-none"
            sizes="90vw"
            priority
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-white/20">
        <div className="flex gap-2 overflow-x-auto justify-center py-2 scrollbar-thin">
          {urls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                i === index ? "border-primary-green ring-2 ring-primary-green/50" : "border-transparent hover:border-white/50"
              }`}
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type PhotoAlbumSectionProps = {
  urls: string[];
  title?: string;
  /** Max number of thumbnails to show in the grid (e.g. 8 for groups). Omit to show all. */
  maxGrid?: number;
  className?: string;
};

export function PhotoAlbumSection({ urls, title, maxGrid, className }: PhotoAlbumSectionProps) {
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [galleryIndex, setGalleryIndex] = React.useState(0);

  if (urls.length === 0) return null;

  const gridUrls = maxGrid != null ? urls.slice(0, maxGrid) : urls;

  return (
    <>
      <section className={className}>
        {title && (
          <h2 className="text-lg font-semibold md:text-xl mb-4">{title}</h2>
        )}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-4">
          {gridUrls.map((url, i) => (
            <li key={i} className="relative aspect-square w-full overflow-hidden rounded-lg">
              <button
                type="button"
                className="relative w-full h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-green focus:ring-offset-2 rounded-lg overflow-hidden"
                onClick={() => {
                  setGalleryIndex(i);
                  setGalleryOpen(true);
                }}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover hover:opacity-90 transition-opacity"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
      {galleryOpen && (
        <ImageGallery
          urls={urls}
          initialIndex={galleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}
