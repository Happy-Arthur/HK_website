import { useState } from "react";

export default function TestApp() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="container mx-auto p-4 max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">React App Test</h1>
        <div className="bg-card rounded-lg shadow-lg p-6">
          <p className="text-xl mb-4 text-center">Count: {count}</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setCount(count + 1)}
              className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
            >
              Increment
            </button>
            <button
              onClick={() => setCount(count - 1)}
              className="bg-destructive text-white px-4 py-2 rounded hover:bg-destructive/90"
            >
              Decrement
            </button>
            <button
              onClick={() => setCount(0)}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/90"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}