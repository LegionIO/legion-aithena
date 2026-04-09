import AppKit
import Foundation

let sourceIconScale: CGFloat = 1.0

func drawIcon(size: CGFloat, sourceImage: NSImage, scale: CGFloat) throws -> Data {
    let image = NSImage(size: NSSize(width: size, height: size))
    image.lockFocus()
    guard let context = NSGraphicsContext.current?.cgContext else {
        throw NSError(domain: "IconGen", code: 1)
    }

    context.setAllowsAntialiasing(true)
    context.interpolationQuality = .high

    let drawSize = size * scale
    let drawRect = NSRect(
        x: (size - drawSize) / 2,
        y: (size - drawSize) / 2,
        width: drawSize,
        height: drawSize
    )
    sourceImage.draw(in: drawRect, from: .zero, operation: .copy, fraction: 1.0)

    image.unlockFocus()

    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "IconGen", code: 2)
    }

    return png
}

func appendUInt16(_ value: UInt16, to data: inout Data) {
    var little = value.littleEndian
    data.append(Data(bytes: &little, count: MemoryLayout<UInt16>.size))
}

func appendUInt32(_ value: UInt32, to data: inout Data) {
    var little = value.littleEndian
    data.append(Data(bytes: &little, count: MemoryLayout<UInt32>.size))
}

func createICO(from images: [(Int, Data)], to destination: URL) throws {
    var data = Data()
    appendUInt16(0, to: &data)
    appendUInt16(1, to: &data)
    appendUInt16(UInt16(images.count), to: &data)

    let headerSize = 6 + (16 * images.count)
    var offset = UInt32(headerSize)

    for (size, pngData) in images {
        data.append(UInt8(size == 256 ? 0 : size))
        data.append(UInt8(size == 256 ? 0 : size))
        data.append(0)
        data.append(0)
        appendUInt16(1, to: &data)
        appendUInt16(32, to: &data)
        appendUInt32(UInt32(pngData.count), to: &data)
        appendUInt32(offset, to: &data)
        offset += UInt32(pngData.count)
    }

    for (_, pngData) in images {
        data.append(pngData)
    }

    try data.write(to: destination)
}

func createICNS(from iconset: URL, to destination: URL) throws {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
    process.arguments = ["-c", "icns", iconset.path, "-o", destination.path]
    try process.run()
    process.waitUntilExit()

    guard process.terminationStatus == 0 else {
        throw NSError(
            domain: "IconGen",
            code: 3,
            userInfo: [NSLocalizedDescriptionKey: "iconutil failed while creating \(destination.lastPathComponent)"]
        )
    }
}

let fileManager = FileManager.default
let repoRoot = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let buildDir = repoRoot.appendingPathComponent("branding/build")
try fileManager.createDirectory(at: buildDir, withIntermediateDirectories: true)

let sourceCandidates = [
    buildDir.appendingPathComponent("icon-source.png"),
    buildDir.appendingPathComponent("icon-master.png"),
]

guard
    let sourceURL = sourceCandidates.first(where: { fileManager.fileExists(atPath: $0.path) }),
    let sourceImage = NSImage(contentsOf: sourceURL)
else {
    throw NSError(
        domain: "IconGen",
        code: 4,
        userInfo: [NSLocalizedDescriptionKey: "No source icon found in branding/build"]
    )
}

let master = buildDir.appendingPathComponent("icon-master.png")
let iconPNG = buildDir.appendingPathComponent("icon.png")
let iconICO = buildDir.appendingPathComponent("icon.ico")
let iconICNS = buildDir.appendingPathComponent("icon.icns")
let iconset = buildDir.appendingPathComponent("icon.iconset")

if fileManager.fileExists(atPath: iconset.path) {
    try fileManager.removeItem(at: iconset)
}
try fileManager.createDirectory(at: iconset, withIntermediateDirectories: true)
defer {
    try? fileManager.removeItem(at: iconset)
}

let iconsetSpecs: [(String, CGFloat)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

for (name, size) in iconsetSpecs {
    let pngData = try drawIcon(size: size, sourceImage: sourceImage, scale: sourceIconScale)
    try pngData.write(to: iconset.appendingPathComponent(name))
}

try drawIcon(size: 1024, sourceImage: sourceImage, scale: sourceIconScale).write(to: master)
try drawIcon(size: 512, sourceImage: sourceImage, scale: sourceIconScale).write(to: iconPNG)

let icoSizes = [16, 24, 32, 48, 64, 128, 256]
let icoImages = try icoSizes.map { size in
    (size, try drawIcon(size: CGFloat(size), sourceImage: sourceImage, scale: sourceIconScale))
}
try createICO(from: icoImages, to: iconICO)
try createICNS(from: iconset, to: iconICNS)

print(sourceURL.path)
print(master.path)
print(iconPNG.path)
print(iconICO.path)
print(iconICNS.path)
