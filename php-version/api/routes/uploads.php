<?php

declare(strict_types=1);

const ALLOWED_IMAGE_TYPES = [
    'image/jpeg' => '.jpg',
    'image/png' => '.png',
    'image/webp' => '.webp',
    'image/gif' => '.gif',
];

function register_upload_routes(Router $router): void
{
    $router->post('/api/uploads/image', function (): void {
        Auth::user();

        if (!isset($_FILES['image'])) {
            throw new ApiException(400, 'Please choose an image to upload', 'VALIDATION_ERROR', ['code' => 'NO_FILE']);
        }

        $file = $_FILES['image'];

        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_INI_SIZE || ($file['error'] ?? 0) === UPLOAD_ERR_FORM_SIZE) {
            throw new ApiException(413, 'That file is too large', 'FILE_TOO_LARGE');
        }
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            bad_request('The upload failed, please try again', [['field' => 'image']]);
        }

        $maxBytes = (int) config('max_upload_bytes');
        if (($file['size'] ?? 0) > $maxBytes) {
            throw new ApiException(413, 'That file is too large', 'FILE_TOO_LARGE');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($file['tmp_name']);
        if (!array_key_exists($mime, ALLOWED_IMAGE_TYPES)) {
            throw new ApiException(400, 'Only JPG, PNG, WEBP or GIF images are allowed', 'INVALID_FILE_TYPE');
        }

        $directory = (string) config('uploads_dir');
        if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new ApiException(500, 'Uploads folder is not writable', 'UPLOAD_UNAVAILABLE');
        }

        $fileName = (int) round(microtime(true) * 1000) . '-' . bin2hex(random_bytes(6)) . ALLOWED_IMAGE_TYPES[$mime];
        $target = $directory . DIRECTORY_SEPARATOR . $fileName;

        if (!move_uploaded_file($file['tmp_name'], $target)) {
            throw new ApiException(500, 'Could not save the uploaded file', 'UPLOAD_FAILED');
        }

        $relative = '/uploads/' . $fileName;
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

        ok([
            'url' => $relative,
            'absoluteUrl' => $scheme . '://' . $host . $relative,
            'fileName' => $fileName,
            'size' => (int) $file['size'],
        ], ['message' => 'Image uploaded'], 201);
    });
}
