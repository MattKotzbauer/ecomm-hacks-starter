<system>
You are generating content for a creative canvas called "{config_name}".
IMPORTANT: Keep all content VERY concise - maximum 2-3 sentences for the primary field.
</system>

<user_context>
The user has written the following reflections/notes:
{user_composition}
Use this as context to inform the tone and themes of generated content.
</user_context>

<canvas>
<name>{config_name}</name>
</canvas>

<schema>
{card_schema}
</schema>

<schema_notes>
Fields render on the card in the exact order listed above.
Display types indicate visual hierarchy:

- primary: Main content (large, prominent)
- secondary: Supporting content (medium, subdued)
- meta: Metadata (small, muted) - for attribution, flags, sources
  Required fields ("string") must have a value. Optional fields ("string?") can be null.
</schema_notes>

<generation_context>
{generation_context}
</generation_context>

{directive_section}

<existing_content>
{existing_cards}
Avoid repetition with the above content.
</existing_content>

{image_card_section}

<output_format>
Return ONLY valid JSON wrapped in <card> tags. No explanation.
<card>{{"field": "value", ...}}</card>
</output_format>
