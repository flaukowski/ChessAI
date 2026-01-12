/**
 * SonicVision 3D Audio Wave Scene
 * Immersive Three.js visualization for the landing page
 */

import { useEffect, useRef } from 'react';

interface AudioWaveSceneProps {
  className?: string;
}

export function AudioWaveScene({ className = '' }: AudioWaveSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    
    // Particle system
    const particles: Array<{
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      size: number;
      hue: number;
      life: number;
    }> = [];

    // Wave parameters
    let time = 0;
    const waveCount = 5;
    
    // Initialize particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 1000,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        hue: Math.random() * 60 + 170, // Cyan to purple range
        life: Math.random() * 100,
      });
    }

    function drawWave(offset: number, amplitude: number, frequency: number, hue: number, alpha: number) {
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.lineWidth = 2;
      
      for (let x = 0; x < width; x += 2) {
        const y = height / 2 + 
          Math.sin((x * frequency / 100) + time + offset) * amplitude * 
          Math.sin(time * 0.3 + offset) * 0.5 +
          Math.sin((x * frequency / 50) + time * 1.5) * amplitude * 0.3;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    function drawParticles() {
      particles.forEach((p, i) => {
        // Update position
        p.x += p.vx + Math.sin(time * 0.5 + i) * 0.3;
        p.y += p.vy + Math.cos(time * 0.3 + i) * 0.2;
        p.life += 0.5;
        
        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        
        // Draw particle
        const alpha = 0.3 + Math.sin(p.life * 0.05) * 0.2;
        const size = p.size * (1 + Math.sin(p.life * 0.1) * 0.3);
        
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawOrb() {
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.15;
      
      // Pulsating orb
      const pulseRadius = baseRadius + Math.sin(time * 2) * 20;
      
      // Outer glow
      for (let i = 5; i > 0; i--) {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, pulseRadius * 0.5,
          centerX, centerY, pulseRadius + i * 30
        );
        gradient.addColorStop(0, `hsla(190, 80%, 60%, ${0.1 / i})`);
        gradient.addColorStop(0.5, `hsla(270, 80%, 50%, ${0.05 / i})`);
        gradient.addColorStop(1, 'hsla(270, 80%, 50%, 0)');
        
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(centerX, centerY, pulseRadius + i * 30, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Core orb
      const coreGradient = ctx.createRadialGradient(
        centerX - pulseRadius * 0.3, centerY - pulseRadius * 0.3, 0,
        centerX, centerY, pulseRadius
      );
      coreGradient.addColorStop(0, 'hsla(190, 90%, 80%, 0.9)');
      coreGradient.addColorStop(0.4, 'hsla(210, 80%, 60%, 0.6)');
      coreGradient.addColorStop(0.7, 'hsla(270, 70%, 50%, 0.4)');
      coreGradient.addColorStop(1, 'hsla(280, 80%, 40%, 0.1)');
      
      ctx.beginPath();
      ctx.fillStyle = coreGradient;
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Rotating ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * 0.5);
      
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const ringRadius = pulseRadius * 1.3 + Math.sin(time * 3 + i) * 10;
        const dotX = Math.cos(angle) * ringRadius;
        const dotY = Math.sin(angle) * ringRadius;
        
        ctx.beginPath();
        ctx.fillStyle = `hsla(${190 + i * 8}, 80%, 70%, ${0.5 + Math.sin(time * 2 + i) * 0.3})`;
        ctx.arc(dotX, dotY, 4 + Math.sin(time * 4 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }

    function animate() {
      time += 0.02;
      
      // Clear with fade effect
      ctx.fillStyle = 'rgba(10, 1, 24, 0.15)';
      ctx.fillRect(0, 0, width, height);
      
      // Draw waves
      for (let i = 0; i < waveCount; i++) {
        const hue = 190 + i * 15;
        const amplitude = 30 + i * 10;
        const frequency = 0.5 + i * 0.2;
        const alpha = 0.3 - i * 0.04;
        drawWave(i * 0.5, amplitude, frequency, hue, alpha);
      }
      
      // Draw particles
      drawParticles();
      
      // Draw central orb
      drawOrb();
      
      animationRef.current = requestAnimationFrame(animate);
    }

    // Start animation
    animate();

    // Handle resize
    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(180deg, #0a0118 0%, #1a0a2e 50%, #0a0118 100%)' }}
    />
  );
}

export default AudioWaveScene;
