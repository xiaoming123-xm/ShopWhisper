"""Provider 能力注册表 - 描述各 provider 的参数差异和能力"""

IMAGE_PROVIDER_CAPABILITIES: dict[str, dict] = {
    "openai": {
        "param_mapping": {"size": "size", "n": "n"},
        "supports_batch": True,
        "max_batch": 4,
        "size_options": [
            {"value": "1024x1024", "label": "1024x1024 (正方形)"},
            {"value": "1024x1792", "label": "1024x1792 (竖版)"},
            {"value": "1792x1024", "label": "1792x1024 (横版)"},
            {"value": "512x512", "label": "512x512 (小图)"},
        ],
        "default_size": "1024x1024",
        "response_parser": "data_url",
        "extra_body": {"response_format": "url"},
    },
    "zhipuai": {
        "param_mapping": {"size": "size"},
        "supports_batch": False,
        "max_batch": 1,
        "size_options": [
            {"value": "1024x1024", "label": "1024x1024 (正方形)"},
            {"value": "768x1344", "label": "768x1344 (竖版)"},
            {"value": "1344x768", "label": "1344x768 (横版)"},
            {"value": "720x1280", "label": "720x1280 (手机竖屏)"},
            {"value": "1280x720", "label": "1280x720 (手机横屏)"},
        ],
        "default_size": "1024x1024",
        "response_parser": "data_url",
        "extra_body": {},
    },
    "siliconflow": {
        "param_mapping": {"size": "image_size", "n": "n"},
        "supports_batch": True,
        "max_batch": 4,
        "size_options": [
            {"value": "1024x1024", "label": "1024x1024 (正方形)"},
            {"value": "512x1024", "label": "512x1024 (竖版)"},
            {"value": "1024x512", "label": "1024x512 (横版)"},
            {"value": "768x512", "label": "768x512 (横版小)"},
            {"value": "512x768", "label": "512x768 (竖版小)"},
        ],
        "default_size": "1024x1024",
        "response_parser": "images_url",
        "extra_body": {},
    },
}

VIDEO_PROVIDER_CAPABILITIES: dict[str, dict] = {
    "zhipuai": {
        "param_mapping": {"duration": "duration", "image_url": "image_url"},
        "supports_image_url": True,
        "duration_options": [
            {"value": 5, "label": "5 秒"},
            {"value": 10, "label": "10 秒"},
        ],
        "default_duration": 5,
    },
    "siliconflow": {
        "param_mapping": {
            "duration": "duration",
            "image_url": "image",
            "image_size": "image_size",
        },
        "supports_image_url": True,
        "duration_options": [
            {"value": 5, "label": "5 秒"},
        ],
        "default_duration": 5,
        "image_size_options": [
            {"value": "1280x720", "label": "1280x720 (横版)"},
            {"value": "720x1280", "label": "720x1280 (竖版)"},
            {"value": "960x960", "label": "960x960 (正方形)"},
        ],
        "default_image_size": "1280x720",
    },
}


def get_capabilities(task_type: str) -> dict[str, dict]:
    if task_type in ("poster", "image"):
        return IMAGE_PROVIDER_CAPABILITIES
    elif task_type == "video":
        return VIDEO_PROVIDER_CAPABILITIES
    return {}
