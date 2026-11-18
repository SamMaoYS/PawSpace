import Foundation
import simd

struct CameraInfo: Encodable {
    let timestamp: Int64
    let intrinsics: [Float]
    let transform: [Float]
    let eulerAngles: SIMD3<Float>
    let quaternion: SIMD4<Float>
    let exposureDuration: Int64

    init(timestamp: TimeInterval, intrinsics: simd_float3x3, transform: simd_float4x4,
         eulerAngles: SIMD3<Float>, exposureDuration: TimeInterval) {
        self.timestamp = Int64(timestamp * 1e9)
        self.intrinsics = (0..<3).flatMap { column in (0..<3).map { intrinsics[column][$0] } }
        self.transform = (0..<4).flatMap { column in (0..<4).map { transform[column][$0] } }
        self.eulerAngles = eulerAngles
        let rotation = simd_quatf(transform)
        quaternion = SIMD4(rotation.real, rotation.imag.x, rotation.imag.y, rotation.imag.z)
        self.exposureDuration = Int64(exposureDuration * 1e9)
    }
}
