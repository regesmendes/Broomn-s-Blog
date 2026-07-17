export function HeroSection() {
  return (
    <section className="relative h-[50vh] min-h-[400px] w-full overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/landscape.jpg')" }}
      />

      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-emerald-950/60" />

      {/* Content */}
      <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-4 text-4xl font-bold text-white drop-shadow-lg md:text-5xl lg:text-6xl">
          Broomn&apos;s Blog
        </h1>
        <p className="max-w-xl text-lg text-amber-100/90 drop-shadow-md md:text-xl">
          Chronicles from a druid storyteller.
          <br />
          A place for stories worth sharing around the fire.
        </p>
      </div>

      {/* Bottom fade into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent dark:from-gray-900" />
    </section>
  );
}
