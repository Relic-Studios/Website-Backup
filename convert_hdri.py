#!/usr/bin/env python3
import struct
import sys

def read_hdr(filename):
    """Read HDR file and convert to basic format"""
    with open(filename, 'rb') as f:
        # Read header
        header = f.readline().decode('ascii')
        if not header.startswith('#?RADIANCE'):
            print("Not a valid RADIANCE HDR file")
            return None

        # Skip header lines
        while True:
            line = f.readline().decode('ascii')
            if line.startswith('-Y'):
                # Parse resolution
                parts = line.split()
                height = int(parts[1])
                width = int(parts[3])
                break

        print(f"HDR Resolution: {width}x{height}")
        print(f"File is too large for web use. Creating placeholder...")

        # Return dimensions for creating placeholder
        return width, height

# Read the HDR
result = read_hdr('assets/images/galaxy_center.hdr')

if result:
    width, height = result
    # Recommend smaller size
    new_width = min(2048, width)
    new_height = int(height * new_width / width)
    print(f"\nRecommended web size: {new_width}x{new_height}")
    print("\nNote: HDR files are not directly supported by Three.js TextureLoader.")
    print("We'll use RGBELoader instead.")
