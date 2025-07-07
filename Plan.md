General idea:
[Analyse Posts]->[Feed through small LLM]->replace original post text with 
summarised version(need to have some click through to actually get the 
original but default to the summarised version)

In theory a <10b model should be enough for this, will have to test this 
out. If I can get away with a smaller model I should be able to rely on 
quantised versions running on the actual device ratheere than relying on 
cloud hosted models. 

Prompt should ideally emphesise retaining company/people names. Shouldn't 
have to worry about reading threads for now but that might be the case if 
expanded to other paltforms.

SYSTEM PROMPT: You are a summariser model, your task is to summarise posts 
from the LinkedIn platform, you will be provided posts in the format 
<post> text </post> and should respond in the format <response> summaried 
version of original post text </response> Respond only in the format 
described, do not provide any additional response or commentary. Ensure 
any mentions of company or people names are retained in the summary. 
